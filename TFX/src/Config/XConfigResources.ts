/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                              TFX CONFIGURATION RESOURCES                                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  PURPOSE:                                                                                         ║
 * ║  Provides embedded default configurations for TFX designers.                                      ║
 * ║  These resources are used when no configuration file is found in the hierarchy.                   ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  RESOURCE NAMING:                                                                                 ║
 * ║  Resources follow the pattern: {Target}.{Group}.json                                              ║
 * ║  Located in: TFX/src/Config/Resources/                                                            ║
 * ║                                                                                                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                                                   ║
 * ║  AVAILABLE RESOURCES:                                                                             ║
 * ║  - ORM.DataType.json: Default ORM data types configuration                                        ║
 * ║                                                                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 */

import { XORMTypesConfig } from "./XConfigurationTypes.js";

/**
 * Embedded configuration resources
 * These are compiled into the library and used as defaults
 */
export class XConfigResources
{
    /**
     * Get default ORM DataType configuration
     * Source: Resources/ORM.DataType.json
     */
    static GetORMDataType(): XORMTypesConfig
    {
        return {
            Name: "DSORMTypes",
            Target: "ORM",
            Group: "DataType",
            Types: [
                {
                    TypeName: "Text",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: false,
                    IsUTF8: true,
                    CanAutoIncrement: false,
                    CSharpTypeID: "D6E6D29B-6496-4AB2-B7E8-7059413DB751"
                },
                {
                    TypeName: "Date",
                    CanUseInPK: false,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "0A34C03B-458F-4BDA-BE51-22175CAAF1E0"
                },
                {
                    TypeName: "DateTime",
                    CanUseInPK: false,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "6C9A2A8B-8418-4475-96DF-51F18B29F381"
                },
                {
                    TypeName: "Binary",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: false,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "B678215D-317B-4E8D-861A-B4F6FCA8AF45"
                },
                {
                    TypeName: "Boolean",
                    CanUseInPK: false,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "B42D0699-00B6-4999-BD36-244B12990C2F"
                },
                {
                    TypeName: "Guid",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "8C5DEBC0-4165-4429-B106-1554552F802E"
                },
                {
                    TypeName: "Int16",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true,
                    CSharpTypeID: "5BD72111-603B-42E5-9488-53A4299E45EB"
                },
                {
                    TypeName: "Int32",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true,
                    CSharpTypeID: "FAADA046-C1B9-4E89-9B64-310E272FC0CC"
                },
                {
                    TypeName: "Int64",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true,
                    CSharpTypeID: "ADD41C4D-6BB4-49A6-856E-4CAA566DEBC2"
                },
                {
                    TypeName: "Numeric",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: true,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: false,
                    CSharpTypeID: "0B16C95D-7DB8-425F-8DFB-F0A9DBA06400"
                },
                {
                    TypeName: "String",
                    CanUseInPK: false,
                    HasLength: true,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: true,
                    CanAutoIncrement: false,
                    CSharpTypeID: "8A656713-0DBB-4D25-9CF9-8DA0DBAD4E62"
                },
                {
                    TypeName: "Int8",
                    CanUseInPK: true,
                    HasLength: false,
                    HasScale: false,
                    CanUseInIndex: true,
                    IsUTF8: false,
                    CanAutoIncrement: true,
                    CSharpTypeID: "D250B45C-AB2E-49F5-B4B9-9BD2479A725A"
                }
            ]
        };
    }

    /**
     * Get resource content as JSON string
     * Useful for writing default files to disk
     */
    static GetORMDataTypeAsJson(): string
    {
        return JSON.stringify(XConfigResources.GetORMDataType(), null, 2);
    }
}
