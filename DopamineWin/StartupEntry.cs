using System.Runtime.InteropServices;

namespace DopamineWin;

/// <summary>
/// "Start with Windows": a value under HKCU\...\Run, so it is per user and needs no admin rights.
/// Off until the user turns it on from the tray, like "Open at login" on macOS.
/// </summary>
internal static unsafe class StartupEntry
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Dopamine";

    private static string Command => $"\"{Environment.ProcessPath}\"";

    public static bool IsEnabled => Read() != null;

    public static bool Set(bool enabled) => Write(enabled ? Command : null);

    /// <summary>If the exe was moved since the entry was written, point the entry at this copy.</summary>
    public static void Refresh()
    {
        var current = Read();
        if (current != null && !string.Equals(current, Command, StringComparison.OrdinalIgnoreCase)) Write(Command);
    }

    private static string? Read()
    {
        IntPtr key;
        fixed (char* sub = RunKey)
            if (RegOpenKeyExW(HKEY_CURRENT_USER, sub, 0, KEY_QUERY_VALUE, &key) != ERROR_SUCCESS) return null;
        try
        {
            uint type, size = 0;
            fixed (char* name = ValueName)
            {
                if (RegQueryValueExW(key, name, IntPtr.Zero, &type, null, &size) != ERROR_SUCCESS || type != REG_SZ || size == 0) return null;
                var buffer = new char[size / 2 + 1];
                fixed (char* data = buffer)
                    if (RegQueryValueExW(key, name, IntPtr.Zero, &type, (byte*)data, &size) != ERROR_SUCCESS) return null;
                return new string(buffer, 0, (int)(size / 2)).TrimEnd('\0');
            }
        }
        finally
        {
            RegCloseKey(key);
        }
    }

    /// <summary>Writes the command, or removes the value when <paramref name="command"/> is null.</summary>
    private static bool Write(string? command)
    {
        IntPtr key;
        fixed (char* sub = RunKey)
            if (RegCreateKeyExW(HKEY_CURRENT_USER, sub, 0, null, 0, KEY_SET_VALUE, IntPtr.Zero, &key, null) != ERROR_SUCCESS)
            {
                Log.Error("Could not open the Run key");
                return false;
            }

        try
        {
            fixed (char* name = ValueName)
            {
                if (command == null) return RegDeleteValueW(key, name) is ERROR_SUCCESS or ERROR_FILE_NOT_FOUND;
                // Strings are stored null-terminated, so the terminator is included in the size.
                fixed (char* data = command)
                    return RegSetValueExW(key, name, 0, REG_SZ, (byte*)data, (uint)((command.Length + 1) * sizeof(char))) == ERROR_SUCCESS;
            }
        }
        finally
        {
            RegCloseKey(key);
        }
    }

    // advapi32, with blittable signatures like the rest of the interop (no runtime marshalling under AOT).
    private static readonly IntPtr HKEY_CURRENT_USER = new(unchecked((int)0x80000001));
    private const uint KEY_QUERY_VALUE = 0x0001, KEY_SET_VALUE = 0x0002, REG_SZ = 1;
    private const int ERROR_SUCCESS = 0, ERROR_FILE_NOT_FOUND = 2;

    [DllImport("advapi32.dll")] private static extern int RegOpenKeyExW(IntPtr key, char* subKey, uint options, uint access, IntPtr* result);
    [DllImport("advapi32.dll")] private static extern int RegCreateKeyExW(IntPtr key, char* subKey, uint reserved, char* cls, uint options, uint access, IntPtr security, IntPtr* result, uint* disposition);
    [DllImport("advapi32.dll")] private static extern int RegQueryValueExW(IntPtr key, char* name, IntPtr reserved, uint* type, byte* data, uint* size);
    [DllImport("advapi32.dll")] private static extern int RegSetValueExW(IntPtr key, char* name, uint reserved, uint type, byte* data, uint size);
    [DllImport("advapi32.dll")] private static extern int RegDeleteValueW(IntPtr key, char* name);
    [DllImport("advapi32.dll")] private static extern int RegCloseKey(IntPtr key);
}
