import { XVsCodeFileSystemAdapter } from "../../Services/VsCodeFileSystemAdapter";
import * as vscode from "vscode";
import * as path from "path";
import { FileType } from "../__mocks__/vscode";

jest.mock("vscode");

describe("VsCodeFileSystemAdapter", () => {
    let adapter: XVsCodeFileSystemAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        adapter = new XVsCodeFileSystemAdapter();
    });

    describe("FileExists", () => {
        it("should return true when file exists", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.File
            });

            const result = await adapter.FileExists("/test/file.txt");

            expect(result).toBe(true);
        });

        it("should return false when path is a directory", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.Directory
            });

            const result = await adapter.FileExists("/test");

            expect(result).toBe(false);
        });

        it("should return false when file does not exist", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error("Not found"));

            const result = await adapter.FileExists("/nonexistent.txt");

            expect(result).toBe(false);
        });
    });

    describe("DirectoryExists", () => {
        it("should return true when directory exists", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.Directory
            });

            const result = await adapter.DirectoryExists("/test");

            expect(result).toBe(true);
        });

        it("should return false when path is a file", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
                type: FileType.File
            });

            const result = await adapter.DirectoryExists("/test/file.txt");

            expect(result).toBe(false);
        });

        it("should return false when directory does not exist", async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error("Not found"));

            const result = await adapter.DirectoryExists("/nonexistent");

            expect(result).toBe(false);
        });
    });

    describe("ReadFile", () => {
        it("should read file content as string", async () => {
            const content = "test content";
            const buffer = Buffer.from(content, "utf-8");
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(buffer);

            const result = await adapter.ReadFile("/test/file.txt");

            expect(result).toBe(content);
        });
    });

    describe("WriteFile", () => {
        it("should write content to file", async () => {
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            await adapter.WriteFile("/test/file.txt", "test content");

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });
    });

    describe("CreateDirectory", () => {
        it("should create directory", async () => {
            (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

            await adapter.CreateDirectory("/test/newdir");

            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });
    });

    describe("GetParentDirectory", () => {
        it("should return parent directory", () => {
            const testPath = path.join("/test", "subdir", "file.txt");
            const expected = path.join("/test", "subdir");
            const result = adapter.GetParentDirectory(testPath);
            expect(result).toBe(expected);
        });
    });

    describe("JoinPath", () => {
        it("should join path segments", () => {
            const result = adapter.JoinPath("/test", "subdir", "file.txt");
            const expected = path.join("/test", "subdir", "file.txt");
            expect(result).toBe(expected);
        });
    });

    describe("GetDirectoryName", () => {
        it("should return directory name", () => {
            const testPath = path.join("/test", "subdir", "file.txt");
            const expected = path.join("/test", "subdir");
            const result = adapter.GetDirectoryName(testPath);
            expect(result).toBe(expected);
        });
    });

    describe("IsRootPath", () => {
        it("should return true for drive root", () => {
            const result = adapter.IsRootPath("/");
            expect(result).toBe(true);
        });

        it("should return false for non-root path", () => {
            const testPath = path.join("/test", "subdir");
            const result = adapter.IsRootPath(testPath);
            expect(result).toBe(false);
        });
    });
});
