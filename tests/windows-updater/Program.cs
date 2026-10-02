using Velopack;

namespace DopamineWin;

internal static class Program
{
    private static void Main()
    {
        VelopackApp.Build().SetAutoApplyOnStartup(false).Run();
        var version = typeof(Program).Assembly.GetName().Version!.Major;
        Log.Write($"launched {version}");
        if (version == 2) return;
        using var stop = new ManualResetEventSlim();
        var settings = new SettingsService();
        using var updates = new UpdateChecker(settings, new UpdateManager("http://127.0.0.1:43127"));
        updates.RestartRequested += () => stop.Set();
        updates.Start();
        settings.SetEnabled(false);
        settings.SetEnabled(true);
        var deadline = DateTime.UtcNow.AddMinutes(2);
        while (DateTime.UtcNow < deadline && !stop.IsSet)
        {
            if (updates.Available?.Ready == true) updates.RequestRestart();
            stop.Wait(250);
        }
        if (!stop.IsSet) { Log.Write("timeout"); return; }
        Log.Write("verified download");
        updates.ApplyOnExit();
    }
}

public sealed class SettingsService
{
    public sealed class Config { public bool CheckForUpdates { get; set; } = true; }
    public Config Settings { get; } = new();
    public event Action? Changed;
    public void SetEnabled(bool enabled) { Settings.CheckForUpdates = enabled; Changed?.Invoke(); }
}

internal static class Log
{
    public static string Result => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DopamineUpdaterSmoke.txt");
    public static void Write(string message) => File.AppendAllText(Result, message + Environment.NewLine);
    public static void Error(string message, Exception? error = null) => Write($"{message}: {error}");
}
