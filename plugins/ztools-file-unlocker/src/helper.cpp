#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <winternl.h>
#include <restartmanager.h>
#include <psapi.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <vector>
#include <string>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <algorithm>

#pragma comment(lib, "rstrtmgr.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")

#ifndef STATUS_SUCCESS
#define STATUS_SUCCESS ((NTSTATUS)0x00000000L)
#endif
#ifndef STATUS_BUFFER_TOO_SMALL
#define STATUS_BUFFER_TOO_SMALL ((NTSTATUS)0xC0000023L)
#endif
#ifndef STATUS_INFO_LENGTH_MISMATCH
#define STATUS_INFO_LENGTH_MISMATCH ((NTSTATUS)0xC0000004L)
#endif

#define SystemExtendedHandleInformation 64
#define ObjectNameInformation 1

typedef struct _SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX {
    PVOID Object;
    ULONG_PTR UniqueProcessId;
    ULONG_PTR HandleValue;
    ULONG GrantedAccess;
    USHORT CreatorBackTraceIndex;
    USHORT ObjectTypeIndex;
    ULONG HandleAttributes;
    ULONG Reserved;
} SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX, *PSYSTEM_HANDLE_TABLE_ENTRY_INFO_EX;

typedef struct _SYSTEM_HANDLE_INFORMATION_EX {
    ULONG_PTR NumberOfHandles;
    ULONG_PTR Reserved;
    SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX Handles[1];
} SYSTEM_HANDLE_INFORMATION_EX, *PSYSTEM_HANDLE_INFORMATION_EX;

typedef NTSTATUS(NTAPI* pfnNtQuerySystemInformation)(
    ULONG SystemInformationClass,
    PVOID SystemInformation,
    ULONG SystemInformationLength,
    PULONG ReturnLength
);

typedef NTSTATUS(NTAPI* pfnNtQueryObject)(
    HANDLE Handle,
    ULONG ObjectInformationClass,
    PVOID ObjectInformation,
    ULONG ObjectInformationLength,
    PULONG ReturnLength
);

pfnNtQuerySystemInformation g_NtQuerySystemInformation = NULL;
pfnNtQueryObject g_NtQueryObject = NULL;

struct ProcessHolderInfo {
    DWORD pid = 0;
    std::wstring appName;
    std::wstring exePath;
    std::wstring matchedPath;
    std::wstring reason;
    std::vector<ULONG_PTR> handles;
};

// JSON 转义辅助函数
std::string EscapeJsonString(const std::wstring& ws) {
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, NULL, 0, NULL, NULL);
    if (len <= 0) return "";
    std::string s(len - 1, 0);
    WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, &s[0], len, NULL, NULL);

    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ((unsigned char)c < 32) {
            char buf[8];
            snprintf(buf, sizeof(buf), "\\u%04x", (unsigned char)c);
            o << buf;
        } else {
            o << c;
        }
    }
    return o.str();
}

void EnableDebugPrivilege() {
    HANDLE hToken;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &hToken)) {
        TOKEN_PRIVILEGES tp;
        tp.PrivilegeCount = 1;
        tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
        if (LookupPrivilegeValueW(NULL, SE_DEBUG_NAME, &tp.Privileges[0].Luid)) {
            AdjustTokenPrivileges(hToken, FALSE, &tp, sizeof(tp), NULL, NULL);
        }
        CloseHandle(hToken);
    }
}

std::wstring NormalizePath(std::wstring p) {
    if (p.empty()) return p;
    for (size_t i = 0; i < p.length(); i++) {
        if (p[i] == L'/') p[i] = L'\\';
    }
    wchar_t fullPath[MAX_PATH * 2] = { 0 };
    if (GetFullPathNameW(p.c_str(), MAX_PATH * 2, fullPath, NULL)) {
        p = fullPath;
    }
    wchar_t longPath[MAX_PATH * 2] = { 0 };
    if (GetLongPathNameW(p.c_str(), longPath, MAX_PATH * 2)) {
        p = longPath;
    }
    while (p.length() > 3 && p.back() == L'\\') {
        p.pop_back();
    }
    return p;
}

std::map<std::wstring, std::wstring> GetDosDeviceMap() {
    std::map<std::wstring, std::wstring> devMap;
    wchar_t driveStrings[512] = { 0 };
    if (GetLogicalDriveStringsW(512, driveStrings)) {
        wchar_t* pDrive = driveStrings;
        while (*pDrive) {
            wchar_t driveLetter[3] = { pDrive[0], L':', L'\0' };
            wchar_t deviceName[MAX_PATH] = { 0 };
            if (QueryDosDeviceW(driveLetter, deviceName, MAX_PATH)) {
                devMap[driveLetter] = deviceName;
            }
            pDrive += wcslen(pDrive) + 1;
        }
    }
    return devMap;
}

std::wstring DosPathToNtPath(const std::wstring& dosPath, const std::map<std::wstring, std::wstring>& devMap) {
    if (dosPath.length() >= 2 && dosPath[1] == L':') {
        std::wstring drive = dosPath.substr(0, 2);
        wchar_t upperDrive[3] = { (wchar_t)towupper(drive[0]), L':', L'\0' };
        auto it = devMap.find(upperDrive);
        if (it != devMap.end()) {
            return it->second + dosPath.substr(2);
        }
    }
    return dosPath;
}

std::wstring NtPathToDosPath(const std::wstring& ntPath, const std::map<std::wstring, std::wstring>& devMap) {
    for (const auto& kv : devMap) {
        if (!kv.second.empty() && _wcsnicmp(ntPath.c_str(), kv.second.c_str(), kv.second.length()) == 0) {
            return kv.first + ntPath.substr(kv.second.length());
        }
    }
    return ntPath;
}

void GetProcessDetails(DWORD pid, std::wstring& exePath, std::wstring& appName) {
    if (!exePath.empty() && !appName.empty()) return;
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (hProcess) {
        wchar_t buf[MAX_PATH * 2] = { 0 };
        DWORD size = sizeof(buf) / sizeof(wchar_t);
        if (QueryFullProcessImageNameW(hProcess, 0, buf, &size)) {
            exePath = buf;
            const wchar_t* pName = PathFindFileNameW(buf);
            if (pName) appName = pName;
        }
        CloseHandle(hProcess);
    }
    if (appName.empty()) {
        appName = L"PID: " + std::to_wstring(pid);
    }
}

bool PathMatches(const std::wstring& candPath, const std::wstring& targetPath, bool targetIsDir) {
    if (candPath.length() < targetPath.length()) return false;
    if (_wcsnicmp(candPath.c_str(), targetPath.c_str(), targetPath.length()) == 0) {
        if (candPath.length() == targetPath.length()) return true;
        if (targetIsDir) {
            wchar_t nextChar = candPath[targetPath.length()];
            if (nextChar == L'\\' || nextChar == L'/') return true;
        }
    }
    return false;
}

// ----------------- 引擎 1：极速扫描所有运行中进程自身 EXE 镜像 -----------------
void ScanRunningProcessImagesFast(const std::wstring& targetDosPath, bool isDir, std::map<DWORD, ProcessHolderInfo>& results) {
    DWORD aProcesses[2048], cbNeeded, cProcesses;
    if (!EnumProcesses(aProcesses, sizeof(aProcesses), &cbNeeded)) return;
    cProcesses = cbNeeded / sizeof(DWORD);
    DWORD currentPid = GetCurrentProcessId();

    for (DWORD i = 0; i < cProcesses; i++) {
        DWORD pid = aProcesses[i];
        if (pid == 0 || pid == 4 || pid == currentPid) continue;

        HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if (!hProcess) continue;

        wchar_t szExeName[MAX_PATH * 2] = { 0 };
        DWORD size = sizeof(szExeName) / sizeof(wchar_t);
        if (QueryFullProcessImageNameW(hProcess, 0, szExeName, &size)) {
            std::wstring normExe = NormalizePath(szExeName);
            if (PathMatches(normExe, targetDosPath, isDir)) {
                auto& holder = results[pid];
                holder.pid = pid;
                holder.exePath = normExe;
                const wchar_t* pName = PathFindFileNameW(normExe.c_str());
                holder.appName = pName ? pName : L"";
                holder.matchedPath = normExe;
                holder.reason = L"RunningExecutable";
            }
        }
        CloseHandle(hProcess);
    }
}

// ----------------- 引擎 2：单次全局内核句柄极速扫描 -----------------
void ScanSystemHandlesFast(const std::wstring& targetDosPath, bool isDir, std::map<DWORD, ProcessHolderInfo>& results) {
    if (!g_NtQuerySystemInformation || !g_NtQueryObject) return;

    auto devMap = GetDosDeviceMap();
    std::wstring targetNtPath = DosPathToNtPath(targetDosPath, devMap);
    std::wstring cleanDos = targetDosPath;
    std::wstring cleanNt = targetNtPath;

    wchar_t tempPath[MAX_PATH] = { 0 };
    GetTempPathW(MAX_PATH, tempPath);
    wchar_t tempFile[MAX_PATH] = { 0 };
    GetTempFileNameW(tempPath, L"unl", 0, tempFile);
    HANDLE hProbeFile = CreateFileW(tempFile, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                    NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);

    ULONG bufferSize = 16 * 1024 * 1024;
    PVOID buffer = VirtualAlloc(NULL, bufferSize, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!buffer) {
        if (hProbeFile != INVALID_HANDLE_VALUE) { CloseHandle(hProbeFile); DeleteFileW(tempFile); }
        return;
    }

    ULONG returnLength = 0;
    NTSTATUS status = g_NtQuerySystemInformation(SystemExtendedHandleInformation, buffer, bufferSize, &returnLength);
    while (status != STATUS_SUCCESS && bufferSize < 128 * 1024 * 1024) {
        VirtualFree(buffer, 0, MEM_RELEASE);
        bufferSize *= 2;
        buffer = VirtualAlloc(NULL, bufferSize, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if (!buffer) break;
        status = g_NtQuerySystemInformation(SystemExtendedHandleInformation, buffer, bufferSize, &returnLength);
    }

    if (status != STATUS_SUCCESS || !buffer) {
        if (hProbeFile != INVALID_HANDLE_VALUE) { CloseHandle(hProbeFile); DeleteFileW(tempFile); }
        if (buffer) VirtualFree(buffer, 0, MEM_RELEASE);
        return;
    }

    PSYSTEM_HANDLE_INFORMATION_EX handleInfoEx = (PSYSTEM_HANDLE_INFORMATION_EX)buffer;
    DWORD currentPid = GetCurrentProcessId();

    USHORT fileTypeIndex = 0;
    if (hProbeFile != INVALID_HANDLE_VALUE) {
        for (ULONG_PTR i = 0; i < handleInfoEx->NumberOfHandles; i++) {
            if ((DWORD)handleInfoEx->Handles[i].UniqueProcessId == currentPid &&
                (HANDLE)handleInfoEx->Handles[i].HandleValue == hProbeFile) {
                fileTypeIndex = handleInfoEx->Handles[i].ObjectTypeIndex;
                break;
            }
        }
        CloseHandle(hProbeFile);
        DeleteFileW(tempFile);
    }

    std::map<DWORD, HANDLE> processHandleCache;
    std::vector<BYTE> nameBuffer(4096);

    for (ULONG_PTR i = 0; i < handleInfoEx->NumberOfHandles; i++) {
        SYSTEM_HANDLE_TABLE_ENTRY_INFO_EX& entry = handleInfoEx->Handles[i];

        if (fileTypeIndex != 0 && entry.ObjectTypeIndex != fileTypeIndex) {
            continue;
        }

        DWORD pid = (DWORD)entry.UniqueProcessId;
        if (pid == 0 || pid == 4 || pid == currentPid) continue;

        HANDLE hProcess = NULL;
        auto itP = processHandleCache.find(pid);
        if (itP != processHandleCache.end()) {
            hProcess = itP->second;
        } else {
            hProcess = OpenProcess(PROCESS_DUP_HANDLE, FALSE, pid);
            processHandleCache[pid] = hProcess;
        }
        if (!hProcess) continue;

        HANDLE hDup = NULL;
        if (!DuplicateHandle(hProcess, (HANDLE)entry.HandleValue, GetCurrentProcess(), &hDup, 0, FALSE, DUPLICATE_SAME_ACCESS)) {
            continue;
        }

        DWORD fileType = GetFileType(hDup);
        if (fileType != FILE_TYPE_DISK) {
            CloseHandle(hDup);
            continue;
        }

        ULONG returnLen = 0;
        status = g_NtQueryObject(hDup, (OBJECT_INFORMATION_CLASS)ObjectNameInformation, &nameBuffer[0], (ULONG)nameBuffer.size(), &returnLen);
        if (status == STATUS_SUCCESS) {
            POBJECT_NAME_INFORMATION nameInfo = (POBJECT_NAME_INFORMATION)&nameBuffer[0];
            if (nameInfo->Name.Buffer && nameInfo->Name.Length > 0) {
                std::wstring objName(nameInfo->Name.Buffer, nameInfo->Name.Length / sizeof(wchar_t));

                bool matched = PathMatches(objName, cleanNt, isDir);
                if (!matched) {
                    std::wstring dosCand = NtPathToDosPath(objName, devMap);
                    matched = PathMatches(dosCand, cleanDos, isDir);
                }

                if (matched) {
                    auto& holder = results[pid];
                    holder.pid = pid;
                    holder.matchedPath = NtPathToDosPath(objName, devMap);
                    if (holder.reason.empty()) {
                        holder.reason = isDir ? L"DirectoryHandle" : L"FileHandle";
                    }
                    holder.handles.push_back(entry.HandleValue);
                }
            }
        }

        CloseHandle(hDup);
    }

    for (auto& pair : processHandleCache) {
        if (pair.second) CloseHandle(pair.second);
    }
    VirtualFree(buffer, 0, MEM_RELEASE);

    for (auto& pair : results) {
        GetProcessDetails(pair.first, pair.second.exePath, pair.second.appName);
    }
}

// ----------------- 引擎 3：Restart Manager 扫描 -----------------
void ScanWithRestartManager(const std::wstring& targetPath, std::map<DWORD, ProcessHolderInfo>& results) {
    DWORD dwSession;
    WCHAR szSessionKey[CCH_RM_SESSION_KEY + 1] = { 0 };
    DWORD dwError = RmStartSession(&dwSession, 0, szSessionKey);
    if (dwError != ERROR_SUCCESS) return;

    LPCWSTR rgsFileNames[] = { targetPath.c_str() };
    dwError = RmRegisterResources(dwSession, 1, rgsFileNames, 0, NULL, 0, NULL);
    if (dwError == ERROR_SUCCESS) {
        DWORD dwReason = 0;
        UINT nProcInfoNeeded = 0;
        UINT nProcInfo = 0;
        dwError = RmGetList(dwSession, &nProcInfoNeeded, &nProcInfo, NULL, &dwReason);
        if (dwError == ERROR_MORE_DATA && nProcInfoNeeded > 0) {
            std::vector<RM_PROCESS_INFO> procInfos(nProcInfoNeeded);
            nProcInfo = nProcInfoNeeded;
            dwError = RmGetList(dwSession, &nProcInfoNeeded, &nProcInfo, &procInfos[0], &dwReason);
            if (dwError == ERROR_SUCCESS) {
                for (UINT i = 0; i < nProcInfo; i++) {
                    DWORD pid = procInfos[i].Process.dwProcessId;
                    if (pid == 0 || pid == GetCurrentProcessId()) continue;
                    auto& item = results[pid];
                    item.pid = pid;
                    if (procInfos[i].strAppName[0] && item.appName.empty()) {
                        item.appName = procInfos[i].strAppName;
                    }
                    GetProcessDetails(pid, item.exePath, item.appName);
                    item.matchedPath = targetPath;
                    if (item.reason.empty()) item.reason = L"RestartManager";
                }
            }
        }
    }
    RmEndSession(dwSession);
}

// ----------------- 关闭远程进程的句柄 -----------------
bool CloseRemoteHandle(DWORD pid, ULONG_PTR handleValue) {
    HANDLE hProcess = OpenProcess(PROCESS_DUP_HANDLE, FALSE, pid);
    if (!hProcess) return false;
    HANDLE hDup = NULL;
    BOOL res = DuplicateHandle(hProcess, (HANDLE)handleValue, GetCurrentProcess(), &hDup, 0, FALSE, DUPLICATE_CLOSE_SOURCE);
    if (hDup) CloseHandle(hDup);
    CloseHandle(hProcess);
    return res != FALSE;
}

// ----------------- 终止远程进程 -----------------
bool KillProcessById(DWORD pid) {
    HANDLE hProcess = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
    if (!hProcess) return false;
    BOOL res = TerminateProcess(hProcess, 1);
    CloseHandle(hProcess);
    return res != FALSE;
}

// ----------------- 将文件/文件夹移至回收站 -----------------
bool MoveToRecycleBin(const std::wstring& targetPath) {
    if (targetPath.empty()) return false;
    
    // SHFILEOPSTRUCTW 要求 pFrom 是以两个 null 字符结尾的字符串
    std::vector<wchar_t> buffer(targetPath.length() + 2, 0);
    wcsncpy_s(&buffer[0], buffer.size(), targetPath.c_str(), targetPath.length());
    buffer[targetPath.length()] = L'\0';
    buffer[targetPath.length() + 1] = L'\0';

    SHFILEOPSTRUCTW fileOp = { 0 };
    fileOp.wFunc = FO_DELETE;
    fileOp.pFrom = buffer.data();
    fileOp.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;

    int result = SHFileOperationW(&fileOp);
    return (result == 0 && !fileOp.fAnyOperationsAborted);
}

int wmain(int argc, wchar_t* argv[]) {
    SetConsoleOutputCP(CP_UTF8);
    EnableDebugPrivilege();

    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (hNtdll) {
        g_NtQuerySystemInformation = (pfnNtQuerySystemInformation)GetProcAddress(hNtdll, "NtQuerySystemInformation");
        g_NtQueryObject = (pfnNtQueryObject)GetProcAddress(hNtdll, "NtQueryObject");
    }

    if (argc < 2) {
        std::cout << "Usage:\n  unlocker-helper list <path>\n  unlocker-helper kill <pid>\n  unlocker-helper close-handle <pid> <handleHex>\n  unlocker-helper recycle <path>\n";
        return 0;
    }

    std::wstring cmd = argv[1];

    if (cmd == L"recycle" && argc >= 3) {
        std::wstring targetPath = NormalizePath(argv[2]);
        bool ok = MoveToRecycleBin(targetPath);
        std::cout << "{\"ok\": " << (ok ? "true" : "false") << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == L"list" && argc >= 3) {
        std::wstring targetPath = NormalizePath(argv[2]);

        DWORD attrs = GetFileAttributesW(targetPath.c_str());
        bool isDir = (attrs != INVALID_FILE_ATTRIBUTES) && (attrs & FILE_ATTRIBUTE_DIRECTORY);

        std::map<DWORD, ProcessHolderInfo> results;

        // 引擎 1：运行中进程自身 EXE 镜像扫描（极速遍历，彻底解决目录下运行的程序）
        ScanRunningProcessImagesFast(targetPath, isDir, results);

        // 引擎 2：内核句柄极速扫描（覆盖所有打开的文件/文件夹句柄）
        ScanSystemHandlesFast(targetPath, isDir, results);

        // 引擎 3：Restart Manager 扫描（单文件补充）
        if (results.empty() && !isDir) {
            ScanWithRestartManager(targetPath, results);
        }

        std::cout << "[\n";
        bool first = true;
        for (const auto& pair : results) {
            const auto& h = pair.second;
            if (!first) std::cout << ",\n";
            first = false;

            std::cout << "  {\n";
            std::cout << "    \"pid\": " << h.pid << ",\n";
            std::cout << "    \"name\": \"" << EscapeJsonString(h.appName) << "\",\n";
            std::cout << "    \"exe\": \"" << EscapeJsonString(h.exePath) << "\",\n";
            std::cout << "    \"matchedPath\": \"" << EscapeJsonString(h.matchedPath) << "\",\n";
            std::cout << "    \"reason\": \"" << EscapeJsonString(h.reason) << "\",\n";
            std::cout << "    \"handles\": [";
            for (size_t i = 0; i < h.handles.size(); i++) {
                if (i > 0) std::cout << ", ";
                std::cout << "\"0x" << std::hex << h.handles[i] << std::dec << "\"";
            }
            std::cout << "]\n";
            std::cout << "  }";
        }
        std::cout << "\n]\n";
        return 0;
    }

    if (cmd == L"kill" && argc >= 3) {
        DWORD pid = (DWORD)_wtoi(argv[2]);
        bool ok = KillProcessById(pid);
        std::cout << "{\"ok\": " << (ok ? "true" : "false") << ", \"pid\": " << pid << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == L"close-handle" && argc >= 4) {
        DWORD pid = (DWORD)_wtoi(argv[2]);
        ULONG_PTR handleVal = (ULONG_PTR)wcstoull(argv[3], NULL, 0);
        bool ok = CloseRemoteHandle(pid, handleVal);
        std::cout << "{\"ok\": " << (ok ? "true" : "false") << "}\n";
        return ok ? 0 : 1;
    }

    return 0;
}
