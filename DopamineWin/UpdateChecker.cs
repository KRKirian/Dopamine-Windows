using Velopack;
using Velopack.Sources;

namespace DopamineWin;

/// <summary>Downloads updates in the background and applies them after a graceful shutdown.</summary>
public sealed class UpdateChecker : IDisposable
{
    public sealed record Release(string Version, string Url, bool Ready);
    private readonly UpdateManager _manager;
    private readonly SettingsService _settings;
    private readonly Timer _timer;
    private readonly CancellationTokenSource _cancel = new();
    private readonly object _gate = new();
    private Release? _found;
    private int _checking;
    private bool _wasEnabled;
    private bool _restart;
    public event Action? RestartRequested;

    public UpdateChecker(SettingsService settings) : this(settings, new UpdateManager(new GithubSource("https://github.com/TempestShaw/Dopamine", null, false))) {}

    internal UpdateChecker(SettingsService settings, UpdateManager manager)
    {
        _manager = manager;
        _settings = settings;
        _wasEnabled = settings.Settings.CheckForUpdates;
        _timer = new Timer(_ => _ = Check(), null, Timeout.Infinite, Timeout.Infinite);
        _settings.Changed += OnSettingsChanged;
    }

    public Release? Available { get { lock (_gate) return _found; } }

    public void Start() => _timer.Change(TimeSpan.FromMinutes(1), TimeSpan.FromHours(24));

    private void OnSettingsChanged()
    {
        var enabled = _settings.Settings.CheckForUpdates;
        lock (_gate)
        {
            if (enabled == _wasEnabled) return;
            _wasEnabled = enabled;
            if (!enabled) _found = null;
        }
        if (enabled) _ = Check();
    }

    private async Task Check()
    {
        if (!_settings.Settings.CheckForUpdates || !_manager.IsInstalled || Interlocked.Exchange(ref _checking, 1) != 0) return;
        try
        {
            var pending = _manager.UpdatePendingRestart;
            if (pending != null) { Set(pending, true); return; }
            var update = await _manager.CheckForUpdatesAsync();
            if (update == null) return;
            Set(update.TargetFullRelease, false);
            await _manager.DownloadUpdatesAsync(update, cancelToken: _cancel.Token);
            Set(update.TargetFullRelease, true);
        }
        catch (Exception ex)
        {
            lock (_gate) _found = null;
            if (!_cancel.IsCancellationRequested) Log.Error("Update failed", ex);
        }
        finally { Interlocked.Exchange(ref _checking, 0); }
    }

    private void Set(VelopackAsset asset, bool ready)
    {
        var version = asset.Version.ToString();
        lock (_gate)
            _found = _settings.Settings.CheckForUpdates
                ? new Release(version, $"https://github.com/TempestShaw/Dopamine/releases/tag/v{version}", ready) : null;
    }

    public bool RequestRestart()
    {
        lock (_gate)
        {
            if (!_settings.Settings.CheckForUpdates || _found?.Ready != true || RestartRequested == null || _restart) return false;
            _restart = true;
        }
        _ = Task.Run(async () => { await Task.Delay(500); RestartRequested?.Invoke(); });
        return true;
    }

    /// <summary>Call after flushing tracking and stopping the API; Velopack waits for this process to exit.</summary>
    public void ApplyOnExit()
    {
        if (!_settings.Settings.CheckForUpdates || !_manager.IsInstalled) return;
        try
        {
            if (_manager.UpdatePendingRestart is { } pending)
                _manager.WaitExitThenApplyUpdates(pending, silent: true, restart: _restart);
        }
        catch (Exception ex) { Log.Error("Could not apply update", ex); }
    }

    public void Dispose()
    {
        _settings.Changed -= OnSettingsChanged;
        _timer.Dispose();
        _cancel.Cancel();
    }
}
