import { describe, it, expect, beforeEach, vi } from "vitest";
import { XNodeFileSystemAdapter, XVSCodeFileSystemAdapter } from "../src/Config/XFileSystemAdapters.js";

describe("XNodeFileSystemAdapter", () =>
{
    let adapter: XNodeFileSystemAdapter;

    beforeEach(() =>
    {
        adapter = new XNodeFileSystemAdapter();
    });

    describe("Initialize", () =>
    {
        it("should initialize without error", async () =>
        {
            await adapter.Initialize();
            // No error means success
            expect(true).toBe(true);
        });

        it("should not reinitialize if already initialized", async () =>
        {
            await adapter.Initialize();
            await adapter.Initialize(); // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("EnsureInitialized throws when not initialized", () =>
    {
        it("should throw when FileExists called without initialization", async () =>
        {
            await expect(adapter.FileExists("/test/path")).rejects.toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when DirectoryExists called without initialization", async () =>
        {
            await expect(adapter.DirectoryExists("/test/path")).rejects.toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when ReadFile called without initialization", async () =>
        {
            await expect(adapter.ReadFile("/test/path")).rejects.toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when WriteFile called without initialization", async () =>
        {
            await expect(adapter.WriteFile("/test/path", "content")).rejects.toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when CreateDirectory called without initialization", async () =>
        {
            await expect(adapter.CreateDirectory("/test/path")).rejects.toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when GetParentDirectory called without initialization", () =>
        {
            expect(() => adapter.GetParentDirectory("/test/path")).toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when JoinPath called without initialization", () =>
        {
            expect(() => adapter.JoinPath("/test", "path")).toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when GetDirectoryName called without initialization", () =>
        {
            expect(() => adapter.GetDirectoryName("/test/path")).toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });

        it("should throw when IsRootPath called without initialization", () =>
        {
            expect(() => adapter.IsRootPath("/")).toThrow(
                "XNodeFileSystemAdapter not initialized"
            );
        });
    });

    describe("FileExists", () =>
    {
        it("should return true for existing file", async () =>
        {
            await adapter.Initialize();
            // Test with a known existing file (this test file)
            const result = await adapter.FileExists(__filename);
            expect(result).toBe(true);
        });

        it("should return false for non-existing file", async () =>
        {
            await adapter.Initialize();
            const result = await adapter.FileExists("/nonexistent/file/path.txt");
            expect(result).toBe(false);
        });

        it("should return false for directory", async () =>
        {
            await adapter.Initialize();
            const result = await adapter.FileExists(__dirname);
            expect(result).toBe(false);
        });
    });

    describe("DirectoryExists", () =>
    {
        it("should return true for existing directory", async () =>
        {
            await adapter.Initialize();
            const result = await adapter.DirectoryExists(__dirname);
            expect(result).toBe(true);
        });

        it("should return false for non-existing directory", async () =>
        {
            await adapter.Initialize();
            const result = await adapter.DirectoryExists("/nonexistent/directory");
            expect(result).toBe(false);
        });

        it("should return false for file", async () =>
        {
            await adapter.Initialize();
            const result = await adapter.DirectoryExists(__filename);
            expect(result).toBe(false);
        });
    });

    describe("GetParentDirectory", () =>
    {
        it("should return parent directory", async () =>
        {
            await adapter.Initialize();
            const result = adapter.GetParentDirectory("/test/subdir/file.txt");
            expect(result).toBe("/test/subdir");
        });
    });

    describe("JoinPath", () =>
    {
        it("should join path segments", async () =>
        {
            await adapter.Initialize();
            const result = adapter.JoinPath("/test", "subdir", "file.txt");
            expect(result).toMatch(/test.*subdir.*file\.txt/);
        });
    });

    describe("GetDirectoryName", () =>
    {
        it("should return directory name", async () =>
        {
            await adapter.Initialize();
            const result = adapter.GetDirectoryName("/test/subdir/file.txt");
            expect(result).toBe("/test/subdir");
        });
    });

    describe("IsRootPath", () =>
    {
        it("should return true for Unix root", async () =>
        {
            await adapter.Initialize();
            const result = adapter.IsRootPath("/");
            expect(result).toBe(true);
        });

        it("should return false for non-root path", async () =>
        {
            await adapter.Initialize();
            const result = adapter.IsRootPath("/test/path");
            expect(result).toBe(false);
        });
    });
});

describe("XVSCodeFileSystemAdapter", () =>
{
    let adapter: XVSCodeFileSystemAdapter;

    beforeEach(() =>
    {
        adapter = new XVSCodeFileSystemAdapter();
    });

    describe("SetVSCodeFS", () =>
    {
        it("should set VSCode filesystem", () =>
        {
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });

            adapter.SetVSCodeFS(mockFS, mockURIFactory);
            // No error means success
            expect(true).toBe(true);
        });

        it("should accept custom path separator", () =>
        {
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });

            adapter.SetVSCodeFS(mockFS, mockURIFactory, "\\");
            // No error means success
            expect(true).toBe(true);
        });
    });

    describe("FileExists", () =>
    {
        it("should throw when VSCode filesystem not configured", async () =>
        {
            await expect(adapter.FileExists("/test/path")).rejects.toThrow(
                "VSCode filesystem not configured"
            );
        });

        it("should return true for existing file", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockResolvedValue({ type: 1 }), // FileType.File
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.FileExists("/test/file.txt");
            expect(result).toBe(true);
        });

        it("should return false for directory", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockResolvedValue({ type: 2 }), // FileType.Directory
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.FileExists("/test/dir");
            expect(result).toBe(false);
        });

        it("should return false on error", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockRejectedValue(new Error("Not found")),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.FileExists("/nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("DirectoryExists", () =>
    {
        it("should throw when VSCode filesystem not configured", async () =>
        {
            await expect(adapter.DirectoryExists("/test/path")).rejects.toThrow(
                "VSCode filesystem not configured"
            );
        });

        it("should return true for existing directory", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockResolvedValue({ type: 2 }), // FileType.Directory
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.DirectoryExists("/test/dir");
            expect(result).toBe(true);
        });

        it("should return false for file", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockResolvedValue({ type: 1 }), // FileType.File
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.DirectoryExists("/test/file.txt");
            expect(result).toBe(false);
        });

        it("should return false on error", async () =>
        {
            const mockFS = {
                stat: vi.fn().mockRejectedValue(new Error("Not found")),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.DirectoryExists("/nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("ReadFile", () =>
    {
        it("should throw when VSCode filesystem not configured", async () =>
        {
            await expect(adapter.ReadFile("/test/path")).rejects.toThrow(
                "VSCode filesystem not configured"
            );
        });

        it("should read file contents", async () =>
        {
            const content = "file content";
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn().mockResolvedValue(new TextEncoder().encode(content)),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            const result = await adapter.ReadFile("/test/file.txt");
            expect(result).toBe(content);
        });
    });

    describe("WriteFile", () =>
    {
        it("should throw when VSCode filesystem not configured", async () =>
        {
            await expect(adapter.WriteFile("/test/path", "content")).rejects.toThrow(
                "VSCode filesystem not configured"
            );
        });

        it("should write file contents", async () =>
        {
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn().mockResolvedValue(undefined),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            await adapter.WriteFile("/test/file.txt", "content");
            expect(mockFS.writeFile).toHaveBeenCalled();
        });
    });

    describe("CreateDirectory", () =>
    {
        it("should throw when VSCode filesystem not configured", async () =>
        {
            await expect(adapter.CreateDirectory("/test/path")).rejects.toThrow(
                "VSCode filesystem not configured"
            );
        });

        it("should create directory", async () =>
        {
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn().mockResolvedValue(undefined)
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory);

            await adapter.CreateDirectory("/test/dir");
            expect(mockFS.createDirectory).toHaveBeenCalled();
        });
    });

    describe("GetParentDirectory", () =>
    {
        it("should return parent directory", () =>
        {
            const result = adapter.GetParentDirectory("/test/subdir/file.txt");
            expect(result).toBe("/test/subdir");
        });

        it("should handle trailing slashes", () =>
        {
            const result = adapter.GetParentDirectory("/test/subdir/");
            expect(result).toBe("/test");
        });

        it("should handle Windows paths", () =>
        {
            const result = adapter.GetParentDirectory("C:\\test\\subdir\\file.txt");
            expect(result).toBe("C:\\test\\subdir");
        });

        it("should return root for top-level path", () =>
        {
            const result = adapter.GetParentDirectory("/test");
            expect(result).toBe("/");
        });

        it("should return separator for root path", () =>
        {
            const result = adapter.GetParentDirectory("/");
            expect(result).toBe("/");
        });
    });

    describe("JoinPath", () =>
    {
        it("should join path segments", () =>
        {
            const result = adapter.JoinPath("/test", "subdir", "file.txt");
            expect(result).toBe("/test/subdir/file.txt");
        });

        it("should handle trailing slashes", () =>
        {
            const result = adapter.JoinPath("/test/", "subdir/", "file.txt");
            expect(result).toBe("/test/subdir/file.txt");
        });

        it("should use custom path separator", () =>
        {
            const mockFS = {
                stat: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn()
            };
            const mockURIFactory = (path: string) => ({ fsPath: path });
            adapter.SetVSCodeFS(mockFS, mockURIFactory, "\\");

            const result = adapter.JoinPath("C:\\test", "subdir", "file.txt");
            expect(result).toBe("C:\\test\\subdir\\file.txt");
        });
    });

    describe("GetDirectoryName", () =>
    {
        it("should return directory name", () =>
        {
            const result = adapter.GetDirectoryName("/test/subdir/file.txt");
            expect(result).toBe("/test/subdir");
        });
    });

    describe("IsRootPath", () =>
    {
        it("should return true for Unix root", () =>
        {
            const result = adapter.IsRootPath("/");
            expect(result).toBe(true);
        });

        it("should return true for empty string", () =>
        {
            const result = adapter.IsRootPath("");
            expect(result).toBe(true);
        });

        it("should return true for Windows drive root", () =>
        {
            expect(adapter.IsRootPath("C:")).toBe(true);
            expect(adapter.IsRootPath("C:\\")).toBe(true);
            expect(adapter.IsRootPath("D:")).toBe(true);
        });

        it("should return false for non-root path", () =>
        {
            expect(adapter.IsRootPath("/test/path")).toBe(false);
            expect(adapter.IsRootPath("C:\\test")).toBe(false);
        });
    });
});
