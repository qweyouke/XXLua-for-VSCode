using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using UnityEngine;
using XCore.Utils;
using XLua;
using Object = System.Object;

public class CSharpValue
{
    public string _key;
    public Object _value;
    public string _valueStr;
    public string _valueType;
    public string _tbkey = "null 0";
}


[LuaCallCSharp]
public static class LuaDebugTool
{
    private const BindingFlags PROPERTY_FLAG =
        BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Static;

    private const BindingFlags FIELD_FLAG =
        BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Static;

    private const BindingFlags METHOD_FLAG =
        BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Static;

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

    public static Object GetCSharpValue(Object obj, String key)
    {
        var list = ParseCSharpValue(obj);
        foreach (var value in list)
        {
            if (value._key == key)
            {
                return value._value;
            }
        }

        return null;
    }

    public static string GetTbKey(Object obj)
    {
        return obj.ToString() + " " + obj.GetHashCode();
    }

    public static List<CSharpValue> ParseCSharpValue(Object obj)
    {
        var ret = new List<CSharpValue>();

        var type = obj.GetType();
        //判断是否是数组
        if (type.IsArray)
        {
            var array = (Array)obj;
            var i = 0;
            foreach (var value in array)
            {
                var name = "[" + i + "]";
                PushCSharpValue(ret, value, name);
                i++;
            }

            return ret;
        }

        //判断是否是泛型
        if (type.IsGenericType)
        {
            if (type.GetInterface("IDictionary") != null)
            {
                ParseDictionary(obj, ret);
            }
            else
            {
                ParseList(obj, ret);
            }
        }

        if (type == typeof(ArrayList))
        {
            var arrayList = (ArrayList)obj;
            var i = 0;
            foreach (var value in arrayList)
            {
                var name = "[" + i + "]";
                PushCSharpValue(ret, value, name);

                i++;
            }
            return ret;
        }

        if (type == typeof(Hashtable))
        {
            var map = (Hashtable)obj;
            foreach (DictionaryEntry o in map)
            {
                var name = "[" + o.Key + "]";
                var value = o.Value;


                //这里打个断点看看值是否取得正确
                PushCSharpValue(ret, value, name);
            }
        }


        var infos = type.GetProperties(PROPERTY_FLAG);
        foreach (var info in infos)
        {
            var name = info.Name;
            if (name == "Item") continue;

            try
            {
                var value = info.GetValue(obj, null);
                PushCSharpValue(ret, value, name);
            }
            catch (Exception e)
            {
                PushExceptionCSharpValue(ret, e, name);
            }
        }

        var fields = type.GetFields(FIELD_FLAG);
        foreach (var field in fields)
        {
            var name = field.Name;
            try
            {
                var value = field.GetValue(obj);
                PushCSharpValue(ret, value, name);
            }
            catch (Exception e)
            {
                PushExceptionCSharpValue(ret, e, name);
            }
        }

        var methods = type.GetMethods(METHOD_FLAG);
        foreach (var method in methods)
        {
            var name = method.Name;
            try
            {
                PushCSharpValue(ret, method, name, "Method");
            }
            catch (Exception e)
            {
                PushExceptionCSharpValue(ret, e, name);
            }
        }

        return ret;

    }

    private static void PushCSharpValue(List<CSharpValue> ret, Object value, string name, string valueType = null)
    {
        valueType = valueType ?? value.GetType().ToString();
        var valueStr = value.ToString();
        if (!valueStr.IsNullOrEmpty() && valueStr != "null" && valueStr != "\0")
        {
            ret.Add(new CSharpValue()
            {
                _key = name,
                _value = value,
                _valueStr = valueStr,
                _valueType = valueType,
                _tbkey = GetTbKey(value)
            });
        }
    }

    private static void PushExceptionCSharpValue(List<CSharpValue> ret, Exception e, string name)
    {
        //if (e.InnerException == null) return;
        //var error = e.InnerException.Message;
        //ret.Add(new CSharpValue()
        //{
        //    _key = name,
        //    _value = error,
        //    _valueStr = error,
        //    _valueType = typeof(Object).ToString(),
        //});
    }

    private static void ParseList(Object obj, List<CSharpValue> ret)
    {
        var type = obj.GetType();
        var count = Convert.ToInt32(type.GetProperty("Count")?.GetValue(obj, null));
        var itemPro = type.GetProperty("Item");
        if (itemPro == null) return;
        for (var i = 0; i < count; i++)
        {
            var name = "[" + i + "]";
            var value = itemPro.GetValue(obj, new Object[] { i });
            PushCSharpValue(ret, value, name);
        }
    }
    private static void ParseDictionary(Object obj, List<CSharpValue> ret)
    {
        var type = obj.GetType();
        var keyInfo = type.GetProperty("Keys");
        var valueInfo = type.GetProperty("Values");
        if (keyInfo == null || valueInfo == null) return;

        var keyValues = new ArrayList(keyInfo.GetValue(obj, null) as ICollection);
        var valValues = new ArrayList(valueInfo.GetValue(obj, null) as ICollection);

        for (var i = 0; i < keyValues.Count; i++)
        {
            var name = "[" + keyValues[i] + "]";
            var value = valValues[i];
            PushCSharpValue(ret, value, name);
        }
    }
}