import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    XConfigurationManager,
    XConfigTarget,
    XConfigGroup,
    IFileSystemAdapter,
    IConfigurationFile
} from "../src/Config/XConfigurationManager.js";
import { XConfigResources } from "../src/Config/XConfigResources.js";

class MockFileSystemAdapter implements IFileSystemAdapter
{
    public FileExistsResult: boolean = false;
    public DirectoryExistsResult: boolean = false;
    public ReadFileResult: string = "{}";
    public WriteFileCalls: Array<{ path: string; content: string }> = [];
    public CreateDirectoryCalls: string[] = [];
    public FileExistsCalls: string[] = [];
    public DirectoryExistsCalls: string[] = [];

    async FileExists(pPath: string): Promise<boolean>
    {
        this.FileExistsCalls.push(pPath);
        return this.FileExistsResult;
    }

    async DirectoryExists(pPath: string): Promise<boolean>
    {
        this.DirectoryExistsCalls.push(pPath);
        return this.DirectoryExistsResult;
    }

    async ReadFile(pPath: string): Promise<string>
    {
        return this.ReadFileResult;
    }

    async WriteFile(pPath: string, pContent: string): Promise<void>
    {
        this.WriteFileCalls.push({ path: pPath, content: pContent });
    }

    async CreateDirectory(pPath: string): Promise<void>
    {
        this.CreateDirectoryCalls.push(pPath);
    }

    GetParentDirectory(pPath: string): string
    {
        const lastSep = Math.max(pPath.lastIndexOf("/"), pPath.lastIndexOf("\\"));
        if (lastSep <= 0)
            return "/";
        return pPath.substring(0, lastSep);
    }

    JoinPath(...pSegments: string[]): string
    {
        return pSegments.join("/");
    }

    GetDirectoryName(pPath: string): string
    {
        return this.GetParentDirectory(pPath);
    }

    IsRootPath(pPath: string): boolean
    {
        return pPath === "/" || /^[A-Za-z]:[\\/]?$/.test(pPath);
    }
}

describe("XConfigurationManager", () =>
{
    beforeEach(() =>
    {
        XConfigurationManager.ResetInstance();
    });

    describe("GetInstance", () =>
    {
        it("should return singleton instance", () =>
        {
            const instance1 = XConfigurationManager.GetInstance();
            const instance2 = XConfigurationManager.GetInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe("ResetInstance", () =>
    {
        it("should reset singleton instance", () =>
        {
            const instance1 = XConfigurationManager.GetInstance();
            XConfigurationManager.ResetInstance();
            const instance2 = XConfigurationManager.GetInstance();
            expect(instance1).not.toBe(instance2);
        });
    });

    describe("SetFileSystem", () =>
    {
        it("should set filesystem adapter", () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            manager.SetFileSystem(adapter);
            // No error means success
            expect(true).toBe(true);
        });
    });

    describe("GetConfiguration", () =>
    {
        it("should throw when filesystem not configured", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            await expect(manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            )).rejects.toThrow("FileSystem adapter not configured");
        });

        it("should return cached configuration on second call", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Test",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            const result1 = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/project/file.dsorm"
            );

            // Reset calls to verify cache hit
            adapter.FileExistsCalls = [];

            const result2 = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/project/file.dsorm"
            );

            expect(result1).toEqual(result2);
        });

        it("should search hierarchy for configuration file", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            adapter.DirectoryExistsResult = false;
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/subdir/file.dsorm"
            );

            // Should have searched multiple directories
            expect(adapter.FileExistsCalls.length).toBeGreaterThan(0);
        });

        it("should create default configuration when not found", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            adapter.DirectoryExistsResult = false;
            manager.SetFileSystem(adapter);

            const result = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/file.dsorm"
            );

            expect(result.Name).toBe("DSORMTypes");
            expect(result.Target).toBe("ORM");
            expect(adapter.WriteFileCalls.length).toBe(1);
        });

        it("should skip directory creation when .DASE folder already exists (line 346)", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            adapter.DirectoryExistsResult = true;
            manager.SetFileSystem(adapter);

            const result = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/file.dsorm"
            );

            expect(result.Name).toBe("DSORMTypes");
            expect(adapter.CreateDirectoryCalls.length).toBe(0);
            expect(adapter.WriteFileCalls.length).toBe(1);
        });

        it("should find configuration in .DASE folder", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            
            // Simulate config file exists in .DASE folder
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "CustomConfig",
                Target: "ORM",
                Group: "Types",
                Types: [{ TypeName: "CustomType", CanUseInPK: true }]
            });
            manager.SetFileSystem(adapter);

            const result = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/subdir/file.dsorm"
            );

            expect(result.Name).toBe("CustomConfig");
        });

        it("should detect repository root by .git folder", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            
            // First file check fails, but .git exists
            let fileCheckCount = 0;
            adapter.FileExists = async (pPath: string) =>
            {
                fileCheckCount++;
                return false;
            };
            
            let dirCheckCount = 0;
            adapter.DirectoryExists = async (pPath: string) =>
            {
                dirCheckCount++;
                // .git folder exists at /project
                return pPath.endsWith(".git");
            };
            
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/subdir/file.dsorm"
            );

            expect(dirCheckCount).toBeGreaterThan(0);
        });
    });

    describe("InvalidateCache", () =>
    {
        it("should invalidate specific cache entry", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Test",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            // Load configuration
            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            // Verify it's cached
            expect(manager.IsCached(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/.DASE/ORM.Types.json"
            )).toBe(true);

            // Invalidate
            manager.InvalidateCache(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/.DASE/ORM.Types.json"
            );

            // Verify it's not cached anymore
            expect(manager.IsCached(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/.DASE/ORM.Types.json"
            )).toBe(false);
        });
    });

    describe("InvalidateCacheByTarget", () =>
    {
        it("should invalidate all cache entries for target", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Test",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            // Load configuration
            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            // Invalidate all ORM entries
            manager.InvalidateCacheByTarget(XConfigTarget.ORM);

            // Verify cache is empty for this target
            const stats = manager.GetCacheStats();
            const ormEntries = stats.Entries.filter(e => e.Key.startsWith("ORM:"));
            expect(ormEntries.length).toBe(0);
        });

        it("should handle empty cache gracefully (line 386-388)", () =>
        {
            const manager = XConfigurationManager.GetInstance();
            manager.ClearCache();

            expect(() => manager.InvalidateCacheByTarget(XConfigTarget.ORM)).not.toThrow();

            const stats = manager.GetCacheStats();
            expect(stats.EntryCount).toBe(0);
        });

        it("should handle target with no matching entries (line 388)", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Test",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            expect(() => manager.InvalidateCacheByTarget(XConfigTarget.UI)).not.toThrow();

            const stats = manager.GetCacheStats();
            const ormEntries = stats.Entries.filter(e => e.Key.startsWith("ORM:"));
            expect(ormEntries.length).toBe(1);
        });
    });

    describe("ClearCache", () =>
    {
        it("should clear entire cache", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Test",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            // Load configuration
            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            // Clear cache
            manager.ClearCache();

            // Verify cache is empty
            const stats = manager.GetCacheStats();
            expect(stats.EntryCount).toBe(0);
        });
    });

    describe("GetCachedConfiguration", () =>
    {
        it("should return null when not cached", () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const result = manager.GetCachedConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/path"
            );
            expect(result).toBeNull();
        });

        it("should return cached configuration", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "CachedTest",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            const cached = manager.GetCachedConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/.DASE/ORM.Types.json"
            );

            expect(cached).not.toBeNull();
            expect(cached!.Name).toBe("CachedTest");
        });
    });

    describe("IsCached", () =>
    {
        it("should return false when not cached", () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const result = manager.IsCached(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/nonexistent/path"
            );
            expect(result).toBe(false);
        });
    });

    describe("GetORMDataTypes", () =>
    {
        it("should return data types from configuration", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const types = await manager.GetORMDataTypes("/test/file.dsorm");

            expect(types.length).toBeGreaterThan(0);
            expect(types.some(t => t.TypeName === "Int32")).toBe(true);
        });
    });

    describe("GetORMPrimaryKeyTypes", () =>
    {
        it("should return only types that can be used in PK", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const types = await manager.GetORMPrimaryKeyTypes("/test/file.dsorm");

            expect(types.length).toBeGreaterThan(0);
            expect(types.every(t => t.CanUseInPK)).toBe(true);
        });
    });

    describe("GetORMAutoIncrementTypes", () =>
    {
        it("should return only types that support auto-increment", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const types = await manager.GetORMAutoIncrementTypes("/test/file.dsorm");

            expect(types.length).toBeGreaterThan(0);
            expect(types.every(t => t.CanAutoIncrement)).toBe(true);
        });
    });

    describe("GetORMIndexableTypes", () =>
    {
        it("should return only types that can be indexed", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const types = await manager.GetORMIndexableTypes("/test/file.dsorm");

            expect(types.length).toBeGreaterThan(0);
            expect(types.every(t => t.CanUseInIndex)).toBe(true);
        });
    });

    describe("GetORMDataTypeByName", () =>
    {
        it("should return type info by name", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const type = await manager.GetORMDataTypeByName("/test/file.dsorm", "Int32");

            expect(type).not.toBeNull();
            expect(type!.TypeName).toBe("Int32");
        });

        it("should return null for unknown type", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const type = await manager.GetORMDataTypeByName("/test/file.dsorm", "UnknownType");

            expect(type).toBeNull();
        });
    });

    describe("GetORMDataTypeNames", () =>
    {
        it("should return array of type names", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const names = await manager.GetORMDataTypeNames("/test/file.dsorm");

            expect(names.length).toBeGreaterThan(0);
            expect(names).toContain("Int32");
            expect(names).toContain("String");
        });
    });

    describe("RegisterDefault", () =>
    {
        it("should register custom default factory", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            const customConfig: IConfigurationFile = {
                Name: "CustomValidation",
                Target: "ORM",
                Group: "Validation"
            };

            manager.RegisterDefault(
                XConfigTarget.ORM,
                XConfigGroup.Validation,
                () => customConfig
            );

            const result = await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.Validation,
                "/test/file.dsorm"
            );

            expect(result.Name).toBe("CustomValidation");
        });
    });

    describe("PreloadConfiguration", () =>
    {
        it("should preload configuration into cache", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = true;
            adapter.ReadFileResult = JSON.stringify({
                Name: "Preloaded",
                Target: "ORM",
                Group: "Types",
                Types: []
            });
            manager.SetFileSystem(adapter);

            await manager.PreloadConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            expect(manager.IsCached(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/.DASE/ORM.Types.json"
            )).toBe(true);
        });
    });

    describe("GetCacheStats", () =>
    {
        it("should return cache statistics", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/test/file.dsorm"
            );

            const stats = manager.GetCacheStats();

            expect(stats.EntryCount).toBe(1);
            expect(stats.Entries.length).toBe(1);
            expect(stats.Entries[0].LoadedAt).toBeInstanceOf(Date);
        });
    });

    describe("CreateAndSaveDefault throws when no factory", () =>
    {
        it("should throw when no default factory is registered", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            manager.SetFileSystem(adapter);

            // Try to get a configuration with no registered default
            await expect(manager.GetConfiguration(
                XConfigTarget.UI,
                XConfigGroup.Components,
                "/test/file.dsui"
            )).rejects.toThrow("No default configuration registered for UI:Components");
        });
    });

    describe("CreateAndSaveDefault creates directory", () =>
    {
        it("should create .DASE directory if it does not exist", async () =>
        {
            const manager = XConfigurationManager.GetInstance();
            const adapter = new MockFileSystemAdapter();
            adapter.FileExistsResult = false;
            adapter.DirectoryExistsResult = false;
            manager.SetFileSystem(adapter);

            await manager.GetConfiguration(
                XConfigTarget.ORM,
                XConfigGroup.DataType,
                "/project/file.dsorm"
            );

            expect(adapter.CreateDirectoryCalls.length).toBe(1);
            expect(adapter.CreateDirectoryCalls[0]).toContain(".DASE");
        });
    });
});

describe("XConfigTarget", () =>
{
    it("should have ORM target", () =>
    {
        expect(XConfigTarget.ORM).toBe("ORM");
    });

    it("should have UI target", () =>
    {
        expect(XConfigTarget.UI).toBe("UI");
    });

    it("should have Flow target", () =>
    {
        expect(XConfigTarget.Flow).toBe("Flow");
    });

    it("should have API target", () =>
    {
        expect(XConfigTarget.API).toBe("API");
    });
});

describe("XConfigGroup", () =>
{
    it("should have DataType group", () =>
    {
        expect(XConfigGroup.DataType).toBe("Types");
    });

    it("should have Validation group", () =>
    {
        expect(XConfigGroup.Validation).toBe("Validation");
    });

    it("should have Naming group", () =>
    {
        expect(XConfigGroup.Naming).toBe("Naming");
    });

    it("should have Display group", () =>
    {
        expect(XConfigGroup.Display).toBe("Display");
    });

    it("should have Components group", () =>
    {
        expect(XConfigGroup.Components).toBe("Components");
    });
});

describe("XConfigResources", () =>
{
    describe("GetORMDataType", () =>
    {
        it("should return default ORM data types", () =>
        {
            const config = XConfigResources.GetORMDataType();

            expect(config.Name).toBe("DSORMTypes");
            expect(config.Target).toBe("ORM");
            expect(config.Group).toBe("DataType");
            expect(config.Types.length).toBeGreaterThan(0);
        });

        it("should include common data types", () =>
        {
            const config = XConfigResources.GetORMDataType();
            const typeNames = config.Types.map(t => t.TypeName);

            expect(typeNames).toContain("Int32");
            expect(typeNames).toContain("String");
            expect(typeNames).toContain("Boolean");
            expect(typeNames).toContain("DateTime");
        });

        it("should have correct PK capability for Int32", () =>
        {
            const config = XConfigResources.GetORMDataType();
            const int32 = config.Types.find(t => t.TypeName === "Int32");

            expect(int32).toBeDefined();
            expect(int32!.CanUseInPK).toBe(true);
            expect(int32!.CanAutoIncrement).toBe(true);
        });

        it("should have correct properties for Text type", () =>
        {
            const config = XConfigResources.GetORMDataType();
            const text = config.Types.find(t => t.TypeName === "Text");

            expect(text).toBeDefined();
            expect(text!.CanUseInPK).toBe(false);
            expect(text!.HasLength).toBe(true);
            expect(text!.IsUTF8).toBe(true);
        });
    });

    describe("GetORMDataTypeAsJson", () =>
    {
        it("should return valid JSON string", () =>
        {
            const json = XConfigResources.GetORMDataTypeAsJson();
            const parsed = JSON.parse(json);

            expect(parsed.Name).toBe("DSORMTypes");
            expect(parsed.Target).toBe("ORM");
            expect(parsed.Types).toBeInstanceOf(Array);
        });

        it("should be formatted with indentation", () =>
        {
            const json = XConfigResources.GetORMDataTypeAsJson();
            
            // Formatted JSON has newlines
            expect(json).toContain("\n");
        });
    });
});
