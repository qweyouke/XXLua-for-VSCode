using System;


using System.Reflection;
using UnityEngine;
using System.Collections.Generic;
using UnityEngine.UI;
using System.Collections;
using System.Runtime.InteropServices;
using UnityEditor;
// using SLua;
//ulua 需要在 customTypeList  添加 具体查看文档 https://www.jianshu.com/p/3768fb6f9ade
using XLua; //xlua 文档 https://www.jianshu.com/p/dda945be6bc2
using XUnityCore;

//using SLua; //slua 文档  https://www.jianshu.com/p/4fa26b200108
//slua 请添加特性 [CustomLuaClass]
//[CustomLuaClass]
public class LuaValueInfo
{
    public string name;
    public string valueType;
    public string valueStr;
    public bool isValue;
    public string addr = "0x00000000";
}
public enum LuaIdeDebugInsTypeEnum
{
    KeyValue,
    List,
    None
}


public class SearchValueInfo
{
    public System.Object value;
    public System.String key;
    public LuaValueInfo luaValueInfo;
}

//slua  请添加特性 [CustomLuaClass]
//  [CustomLuaClass]
//xlua 请添加特性 [LuaCallCSharp]
[LuaCallCSharp]
public class LuaDebugTool
{
    private static bool IS_INIT = false;

    [CSharpCallLua]
    public static void Init(LuaFunction func)
    {
        if (IS_INIT)
        {
            return;
        }

        IS_INIT = true;

        Application.wantsToQuit += () =>
        {
            func.Call();
            func.Dispose(true);
            func = null;
            return true;
        };

        
    }

    public static void InitFileList(string searchFolder)
    {
        cache_path = new Dictionary<string, string>();
        var dataPath = Application.dataPath;
        dataPath = dataPath.Substring(0, dataPath.Length - 6);
        string[] assets = UnityEditor.AssetDatabase.FindAssets(null, new[] { searchFolder });
        for (int i = 0; i < assets.Length; i++)
        {
            var str = AssetDatabase.GUIDToAssetPath(assets[i]);
            var idx = str.LastIndexOf("/", StringComparison.Ordinal);
            string name = idx != -1 ? str.Substring(idx + 1, str.Length - idx - 1) : str;
            if (name.IndexOf(".lua", StringComparison.Ordinal) != -1)
            {
                str = dataPath + str;
                if (cache_path.ContainsKey(name))
                {
                    Debug.LogError("有同名文件" + name + "，调试器可能出问题");
                }
                cache_path[name] = str;
            }
        }
    }

    private static bool checkIsValue(Type valueType)
    {
        var isValue = false;
        if (
            valueType == typeof(System.Boolean) ||
            valueType == typeof(System.Byte) ||
            valueType == typeof(System.SByte) ||
            valueType == typeof(System.Char) ||
            valueType == typeof(System.Decimal) ||
            valueType == typeof(System.Double) ||
            valueType == typeof(System.Single) ||
            valueType == typeof(System.Int32) ||
            valueType == typeof(System.UInt32) ||
            valueType == typeof(System.Int64) ||
            valueType == typeof(System.UInt64) ||
            valueType == typeof(System.IntPtr) ||
            valueType == typeof(System.UIntPtr) ||
            valueType == typeof(System.Int16) ||
            valueType == typeof(System.UInt16) ||
            valueType == typeof(System.String) ||
            valueType.IsEnum
            )
        {
            isValue = false;
        }
        else
        {
            isValue = true;
        }
        return isValue;
    }



    public static System.Object getCSharpValue(System.Object obj, String key)
    {
        if (obj == null)
        {
            return null;
        }
        Dictionary<string, SearchValueInfo> values = SearchDataInfo(obj);
        if (values.Count > 0)
        {
            if (values.ContainsKey(key))
            {
                LuaValueInfo value = values[key].luaValueInfo;
                if (value.valueStr == "Null")
                {
                    return null;
                }
                else
                {

                    return values[key].value;
                }

            }
            else
            {
                return null;
            }
        }
        else
        {
            return null;
        }

    }

    private static Dictionary<string, string> cache_path;

    /*获取当前脚本的文件夹路径，参数为脚本的名字*/
    public static string GetPath(string _scriptName, string searchFolder)
    {
        cache_path.TryGetValue(_scriptName, out var ret);
        return ret;
    }

    private static string getMemory(object o) // 获取引用类型的内存地址方法    
    {
        GCHandle h = GCHandle.Alloc(o, GCHandleType.WeakTrackResurrection);

        IntPtr addr = GCHandle.ToIntPtr(h);

        return "0x" + addr.ToString("X");
    }

    static public List<SearchValueInfo> convertLuaValueInfos(Dictionary<string, SearchValueInfo> values)
    {
        List<SearchValueInfo> vs = new List<SearchValueInfo>();
        foreach (SearchValueInfo v in values.Values)
        {
            vs.Add(v);
        }
        return vs;
    }
    static public List<SearchValueInfo> getUserDataInfo(System.Object obj)
    {
        return convertLuaValueInfos(SearchDataInfo(obj));
    }
    static public LuaIdeDebugInsTypeEnum getInsType(Type t)
    {

        if (t.Name.IndexOf("Dictionary`") == 0 || t.Name.IndexOf("SortedDictionary`") == 0 || t.Name.IndexOf("SortedList`") == 0)
        {
            return LuaIdeDebugInsTypeEnum.KeyValue;
        }
        else if (t.Name.IndexOf("List`") == 0)
        {
            return LuaIdeDebugInsTypeEnum.List;
        }
        else
        {
            if (t.BaseType != null)
            {
                return getInsType(t.BaseType);
            }
        }
        return LuaIdeDebugInsTypeEnum.None;
    }
    static public Dictionary<string, SearchValueInfo> SearchDataInfo(System.Object obj)
    {

        Type t = obj.GetType();
        Dictionary<string, SearchValueInfo> values = new Dictionary<string, SearchValueInfo>();
        //判断是否是数组
        if (t.IsArray)
        {
            Array array = (Array)obj;
            int i = 0;
            foreach (object value in array)
            {
                string name = "[" + i + "]";
                values.Add(name, new SearchValueInfo()
                {

                    value = value,
                    key = name,
                    luaValueInfo = new LuaValueInfo()
                    {
                        name = name,
                        valueStr = value.ToString(),
                        valueType = value.GetType().ToString(),
                        isValue = checkIsValue(value.GetType()),
                        addr = getMemory(value)
                    }
                });
                i++;
            }
            return values;
        }
        if (t.IsGenericType)
        {


            LuaIdeDebugInsTypeEnum insType = getInsType(t);
            if (insType == LuaIdeDebugInsTypeEnum.KeyValue)
            {
                return getDictionaryValues(obj);
            }
            else if (insType == LuaIdeDebugInsTypeEnum.List)
            {

                return getListValues(obj);
            }




        }
        if (t == typeof(ArrayList))
        {
            ArrayList arrayList = (ArrayList)obj;
            int i = 0;
            for (int k = 0; k < arrayList.Count; k++)
            {
                var value = arrayList[k];
                string name = "[" + i + "]";
                values.Add(name, new SearchValueInfo()
                {
                    value = value,
                    key = name,
                    luaValueInfo = new LuaValueInfo()
                    {
                        name = name,
                        valueStr = value.ToString(),
                        valueType = value.GetType().ToString(),
                        isValue = checkIsValue(value.GetType()),
                        addr = getMemory(value)
                    }
                });
                i++;
            }
            return values;
        }
        if (t == typeof(Hashtable))
        {
            Hashtable map = (Hashtable)obj;
            ArrayList keyList = new ArrayList(map.Keys);
            for (int i = 0; i < keyList.Count; i++)
            {
                var keyValue = keyList[i];
                var valeValue = map[keyValue];
                var info = new LuaValueInfo()
                {
                    name = "[" + keyValue + "]",
                    valueStr = valeValue.ToString(),
                    valueType = valeValue.GetType().ToString(),
                    isValue = checkIsValue(valeValue.GetType()),
                    addr = getMemory(valeValue)
                };
                values.Add(info.name, new SearchValueInfo() { key = info.name, value = valeValue, luaValueInfo = info });
            }
            return values;
        }


        PropertyInfo[] pinfos = t.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
        foreach (PropertyInfo pinfo in pinfos)
        {
            try
            {
                if (pinfo.Name == "Item")
                {
                    continue;
                }

                var value = pinfo.GetValue(obj, null);

                var valueType = value.GetType();
                values.Add(pinfo.Name, new SearchValueInfo()
                {
                    value = value,
                    key = pinfo.Name,
                    luaValueInfo = new LuaValueInfo()
                    {
                        name = pinfo.Name,
                        valueStr = value.ToString(),
                        valueType = valueType.ToString(),
                        isValue = checkIsValue(valueType),
                        addr = getMemory(value)
                    }
                });

            }
            catch (Exception e)
            {
                String error = e.Message;
                values.Add(pinfo.Name, new SearchValueInfo()
                {
                    value = null,
                    key = pinfo.Name,
                    luaValueInfo = new LuaValueInfo()
                    {
                        name = pinfo.Name,
                        valueStr = "Null",
                        valueType = typeof(string).ToString(),
                        isValue = false,
                    }
                });
            }

        }

        FieldInfo[] fields = t.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.NonPublic);
        foreach (FieldInfo fi in fields)
        {
            try
            {

                string name = fi.Name;
                object value = fi.GetValue(obj);
                Type valueType = null;
                if (value == null)
                {
                    values.Add(name, new SearchValueInfo()
                    {
                        key = name,
                        value = null,
                        luaValueInfo = new LuaValueInfo()
                        {
                            name = name,
                            valueStr = "Null",
                            valueType = typeof(string).ToString(),
                            isValue = false
                        }
                    });
                }
                else
                {
                    valueType = value.GetType();
                    values.Add(name, new SearchValueInfo()
                    {
                        value = value,
                        key = name,
                        luaValueInfo = new LuaValueInfo()
                        {
                            name = name,
                            valueStr = value.ToString(),
                            valueType = valueType.ToString(),
                            isValue = checkIsValue(valueType),
                            addr = getMemory(value)
                        }
                    });
                }
            }
            catch (Exception e)
            {
                values.Add(fi.Name, new SearchValueInfo()
                {
                    value = null,
                    key = fi.Name,
                    luaValueInfo = new LuaValueInfo()
                    {
                        name = fi.Name,
                        valueStr = "Null",
                        valueType = typeof(string).ToString(),
                        isValue = false
                    }
                });
            }
        }
        return values;
    }
    static public Dictionary<string, SearchValueInfo> getListValues(System.Object obj)
    {
        Dictionary<string, SearchValueInfo> values = new Dictionary<string, SearchValueInfo>();
        Type t = obj.GetType();
        int count = Convert.ToInt32(t.GetProperty("Count").GetValue(obj, null));
        PropertyInfo itemPro = t.GetProperty("Item");
        if (itemPro != null)
        {
            for (int i = 0; i < count; i++)
            {

                object listItem = t.GetProperty("Item").GetValue(obj, new object[] { i });
                string name = "[" + i + "]";
                values.Add(name, new SearchValueInfo()
                {
                    key = name,
                    value = listItem,
                    luaValueInfo =
                    new LuaValueInfo(){
                        name = name,
                        valueStr = listItem.ToString(),
                        valueType = listItem.GetType().ToString(),
                        isValue = checkIsValue(listItem.GetType()),
                        addr = getMemory(listItem)
                    }
                });
            }

        }
        return values;
    }
    static public Dictionary<string, SearchValueInfo> getDictionaryValues(System.Object obj)
    {
        Dictionary<string, SearchValueInfo> values = new Dictionary<string, SearchValueInfo>();
        Type t = obj.GetType();
        PropertyInfo keyInfo = t.GetProperty("Keys");
        PropertyInfo valueInfo = t.GetProperty("Values");

        ArrayList keyValues = new ArrayList(keyInfo.GetValue(obj, null) as ICollection);
        ArrayList valValues = new ArrayList(valueInfo.GetValue(obj, null) as ICollection);

        for (int i = 0; i < keyValues.Count; i++)
        {
            object key = keyValues[i];
            object value = valValues[i];
            Type valueType = value.GetType();
            values.Add("[" + key + "]", new SearchValueInfo()
            {
                value = value,
                key = "[" + key + "]",

                luaValueInfo = new LuaValueInfo()
                {
                    name = "[" + key + "]",
                    valueStr = value.ToString(),
                    valueType = valueType.ToString(),
                    isValue = checkIsValue(valueType),
                    addr = getMemory(value)
                }
            });
        }
        return values;

    }

}

