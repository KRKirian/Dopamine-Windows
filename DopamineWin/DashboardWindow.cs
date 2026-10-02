using System.Runtime.InteropServices;
using DopamineWin.Native;
using static DopamineWin.Native.Win32;

namespace DopamineWin;

/// <summary>
/// The dashboard in its own window: a plain Win32 window hosting WebView2 (the Edge runtime that
/// ships with Windows 10 and 11), pointed at the same local dashboard a browser would show.
/// Closing it closes the browser engine too, so the tray agent goes back to its usual footprint.
/// If WebView2 isn't available, the dashboard opens in the default browser as before.
/// </summary>
public sealed unsafe class DashboardWindow
{
    private const string ClassName = "DopamineDashboard";
    private const int ApplicationIconId = 32512;
    private const int Width = 1280, Height = 860, MinWidth = 420, MinHeight = 360; // at 96 dpi

    // The paper colour of the dashboard (globals.css), so the window never flashes white while loading.
    private static readonly (byte R, byte G, byte B) LightPaper = (0xf4, 0xf1, 0xea), DarkPaper = (0x16, 0x15, 0x12);

    private static DashboardWindow? _instance; // the window procedure is static; it reaches the window through this

    private readonly SettingsService _settings;
    private IntPtr _hwnd;
    private IntPtr _controller;
    private IntPtr _webview;
    private bool _creating;
    private bool _loggedLoad;
    private WINDOWPLACEMENT? _placement; // where the window was last closed, for this run

    public DashboardWindow(SettingsService settings)
    {
        _settings = settings;
        _instance = this;
    }

    private string Url => ApiServer.DashboardUrl(_settings.Settings.PairingCode);

    /// <summary>Opens the window, or brings it to the front if it's already open. Call on the tray's UI thread.</summary>
    public void Show()
    {
        if (_hwnd != IntPtr.Zero)
        {
            if (IsIconic(_hwnd) != 0) ShowWindow(_hwnd, SW_RESTORE);
            SetForegroundWindow(_hwnd);
            return;
        }

        if (_creating) return;
        _creating = true;

        int hr;
        var handler = WebView2.Handler(WebView2.IID_EnvironmentCompleted, OnEnvironmentCreated);
        try
        {
            fixed (char* data = AppInfo.DataFile("WebView2"))
                hr = WebView2.CreateCoreWebView2EnvironmentWithOptions(null, data, IntPtr.Zero, handler);
        }
        catch (Exception ex)
        {
            Log.Error("Could not load WebView2", ex);
            hr = Marshal.GetHRForException(ex);
        }
        finally
        {
            WebView2.Release(ref handler);
        }

        if (hr < 0) Fallback($"WebView2 is not available (0x{hr:X8})");
    }

    /// <summary>Closes the window, if open. Used when Dopamine exits.</summary>
    public void Close()
    {
        if (_hwnd != IntPtr.Zero) DestroyWindow(_hwnd);
    }

    private void OnEnvironmentCreated(IntPtr result, IntPtr environment)
    {
        var hr = WebView2.HResult(result);
        if (hr < 0 || environment == IntPtr.Zero)
        {
            Fallback($"Could not start WebView2 (0x{hr:X8})");
            return;
        }

        if (!CreateWindow())
        {
            Fallback("Could not create the dashboard window");
            return;
        }

        var handler = WebView2.Handler(WebView2.IID_ControllerCompleted, OnControllerCreated);
        hr = WebView2.CreateController(environment, _hwnd, handler);
        WebView2.Release(ref handler);
        if (hr < 0)
        {
            DestroyWindow(_hwnd);
            Fallback($"Could not create the WebView2 controller (0x{hr:X8})");
        }
    }

    private void OnControllerCreated(IntPtr result, IntPtr controller)
    {
        _creating = false;
        var hr = WebView2.HResult(result);
        if (hr < 0 || controller == IntPtr.Zero)
        {
            if (_hwnd != IntPtr.Zero) DestroyWindow(_hwnd);
            Fallback($"Could not create the WebView2 controller (0x{hr:X8})");
            return;
        }

        if (_hwnd == IntPtr.Zero)
        {
            WebView2.Close(controller); // closed while loading
            return;
        }

        WebView2.AddRef(controller); // the callback only lends it
        _controller = controller;
        _webview = WebView2.GetCoreWebView2(controller);

        var controller2 = WebView2.QueryInterface(controller, WebView2.IID_Controller2);
        if (controller2 != IntPtr.Zero)
        {
            var paper = IsDarkMode() ? DarkPaper : LightPaper;
            WebView2.SetDefaultBackgroundColor(controller2, paper.R, paper.G, paper.B);
            WebView2.Release(ref controller2);
        }

        var settings = WebView2.GetSettings(_webview);
        if (settings != IntPtr.Zero)
        {
            WebView2.SetStatusBarEnabled(settings, false); // no link previews in the corner, as in a browser
#if !DEBUG
            WebView2.SetDevToolsEnabled(settings, false);
#endif
            WebView2.Release(ref settings);
        }

        AddHandler(WebView2.IID_NewWindowRequested, OnNewWindowRequested, WebView2.AddNewWindowRequested);
        AddHandler(WebView2.IID_NavigationStarting, OnNavigationStarting, WebView2.AddNavigationStarting);
        AddHandler(WebView2.IID_NavigationCompleted, OnNavigationCompleted, WebView2.AddNavigationCompleted);

        Resize();
        WebView2.SetVisible(_controller, true);
        WebView2.Navigate(_webview, Url);
        WebView2.MoveFocus(_controller);
    }

    private void AddHandler(Guid iid, Action<IntPtr, IntPtr> invoke, Func<IntPtr, IntPtr, int> add)
    {
        var handler = WebView2.Handler(iid, invoke);
        add(_webview, handler);
        WebView2.Release(ref handler);
    }

    /// <summary>Links that open a new window (release notes, the source code) go to the default browser.</summary>
    private static void OnNewWindowRequested(IntPtr sender, IntPtr args)
    {
        var uri = WebView2.GetUri(args);
        WebView2.SetNewWindowHandled(args);
        OpenExternally(uri);
    }

    /// <summary>The window only ever shows the local dashboard; anything else opens in the browser.</summary>
    private static void OnNavigationStarting(IntPtr sender, IntPtr args)
    {
        var uri = WebView2.GetUri(args);
        if (IsDashboard(uri)) return;
        WebView2.CancelNavigation(args);
        OpenExternally(uri);
    }

    private void OnNavigationCompleted(IntPtr sender, IntPtr args)
    {
        var success = WebView2.NavigationSucceeded(args);
        if (success && _loggedLoad) return;
        _loggedLoad |= success;
        Log.Info(success ? "Dashboard window loaded" : "Dashboard window failed to load");
    }

    private static bool IsDashboard(string uri) =>
        Uri.TryCreate(uri, UriKind.Absolute, out var u) && u.Scheme == "http" && u.Port == ApiServer.Port &&
        (u.Host == "localhost" || u.Host == "127.0.0.1");

    private static void OpenExternally(string uri)
    {
        if (Uri.TryCreate(uri, UriKind.Absolute, out var u) && (u.Scheme == "https" || u.Scheme == "http" || u.Scheme == "mailto"))
            Win32.Open(uri);
    }

    private void Fallback(string reason)
    {
        _creating = false;
        Log.Error($"{reason}; opening the dashboard in the browser instead");
        Win32.Open(Url);
    }

    private bool CreateWindow()
    {
        var module = GetModuleHandleW(null);
        fixed (char* className = ClassName)
        fixed (char* title = "Dopamine")
        {
            var paper = IsDarkMode() ? DarkPaper : LightPaper;
            var wc = new WNDCLASSEXW
            {
                cbSize = (uint)sizeof(WNDCLASSEXW),
                lpfnWndProc = &WndProc,
                hInstance = module,
                lpszClassName = className,
                hIcon = LoadImageW(module, ApplicationIconId, IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_DEFAULTCOLOR),
                hIconSm = LoadImageW(module, ApplicationIconId, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR),
                hCursor = LoadCursorW(IntPtr.Zero, IDC_ARROW),
                hbrBackground = CreateSolidBrush((uint)(paper.R | paper.G << 8 | paper.B << 16)),
            };
            RegisterClassExW(&wc); // fails harmlessly once the class exists

            _hwnd = CreateWindowExW(0, className, title, WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT,
                IntPtr.Zero, IntPtr.Zero, module, IntPtr.Zero);
        }

        if (_hwnd == IntPtr.Zero) return false;

        var dark = IsDarkMode() ? 1 : 0;
        DwmSetWindowAttribute(_hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &dark, sizeof(int));

        if (_placement is { } saved)
        {
            saved.showCmd = saved.showCmd == SW_SHOWMAXIMIZED ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL;
            SetWindowPlacement(_hwnd, &saved);
        }
        else
        {
            // Centre a comfortable size on the monitor Windows picked, without overflowing a small screen.
            var scale = GetDpiForWindow(_hwnd) / 96.0;
            var monitor = new MONITORINFO { cbSize = (uint)sizeof(MONITORINFO) };
            GetMonitorInfoW(MonitorFromWindow(_hwnd, MONITOR_DEFAULTTONEAREST), &monitor);
            var work = monitor.rcWork;
            var w = Math.Min((int)(Width * scale), (work.Right - work.Left) * 9 / 10);
            var h = Math.Min((int)(Height * scale), (work.Bottom - work.Top) * 9 / 10);
            SetWindowPos(_hwnd, IntPtr.Zero, work.Left + (work.Right - work.Left - w) / 2, work.Top + (work.Bottom - work.Top - h) / 2, w, h,
                SWP_NOZORDER | SWP_NOACTIVATE);
            ShowWindow(_hwnd, SW_SHOWNORMAL);
        }

        SetForegroundWindow(_hwnd);
        return true;
    }

    private void Resize()
    {
        if (_controller == IntPtr.Zero) return;
        RECT bounds;
        GetClientRect(_hwnd, &bounds);
        WebView2.SetBounds(_controller, bounds);
    }

    [UnmanagedCallersOnly]
    private static IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            var window = _instance;
            if (window != null && window._hwnd == hwnd && window.Handle(msg, wParam, lParam) is { } result) return result;
        }
        catch (Exception ex)
        {
            Log.Error("Dashboard window message failed", ex);
        }

        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    private IntPtr? Handle(uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case WM_SIZE:
                Resize();
                return IntPtr.Zero;

            case WM_MOVE:
                if (_controller != IntPtr.Zero) WebView2.NotifyParentWindowPositionChanged(_controller);
                return IntPtr.Zero;

            case WM_SETFOCUS:
                if (_controller != IntPtr.Zero) WebView2.MoveFocus(_controller);
                return IntPtr.Zero;

            case WM_GETMINMAXINFO:
            {
                var scale = GetDpiForWindow(_hwnd) / 96.0;
                var info = (MINMAXINFO*)lParam;
                info->ptMinTrackSize.X = (int)(MinWidth * scale);
                info->ptMinTrackSize.Y = (int)(MinHeight * scale);
                return IntPtr.Zero;
            }

            case WM_DPICHANGED:
            {
                // Per-monitor DPI: take the size Windows suggests for the new monitor.
                var r = (RECT*)lParam;
                SetWindowPos(_hwnd, IntPtr.Zero, r->Left, r->Top, r->Right - r->Left, r->Bottom - r->Top, SWP_NOZORDER | SWP_NOACTIVATE);
                return IntPtr.Zero;
            }

            case WM_DESTROY:
            {
                var placement = new WINDOWPLACEMENT { length = (uint)sizeof(WINDOWPLACEMENT) };
                if (GetWindowPlacement(_hwnd, &placement) != 0) _placement = placement;
                if (_controller != IntPtr.Zero) WebView2.Close(_controller);
                WebView2.Release(ref _webview);
                WebView2.Release(ref _controller);
                _hwnd = IntPtr.Zero;
                return IntPtr.Zero;
            }
        }

        return null;
    }

    /// <summary>Whether Windows is set to dark mode for apps, which the dashboard follows by default.</summary>
    private static bool IsDarkMode()
    {
        uint value = 1, size = sizeof(uint);
        fixed (char* key = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        fixed (char* name = "AppsUseLightTheme")
            return RegGetValueW(HKEY_CURRENT_USER, key, name, RRF_RT_REG_DWORD, IntPtr.Zero, &value, &size) == 0 && value == 0;
    }
}
