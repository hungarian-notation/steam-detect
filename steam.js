
// Begin Polyfills

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

// End Polyfills

// Begin Script

var WShell = WScript.CreateObject("WScript.Shell"); 
var FileSystemObject = WScript.CreateObject("Scripting.FileSystemObject");

function NormalizeString(value) {
  return String(value).replace(new RegExp("[\\\\]", "g"), "\\\\");
}

function indent(i) {
  if (i == 0) {
    return "";
  } else {
    return indent(i - 1) + "  ";
  }
}

function toJson(obj, level) {  
  var str     = "";  

  if (level == null) {
    level = 1
  }

  if (Array.isArray(obj)) {
    str += "[\n";

    for (var i = 0; i < obj.length; ++i) {
      if (i > 0) {
        str += ",\n"
      }

      str += indent(level); 

      if (obj[i] == null) {
        str += "null"
      } else if (typeof obj[i] == "object") {
        str += toJson(obj[i], level + 1);
      } else {
        str += "\"" + NormalizeString(obj[i]) + "\""
      }
    }

    str += "\n";
    str += indent(level - 1) + "]";
  } else {
    var isFirst = true;

    str         += "{\n";

    for (var key in obj) {

      if (!isFirst) {
        str += ",\n"
      } else {
        isFirst = false;
      }

      str += indent(level) + "\"" + key + "\"" + ":" + " "; 

      if (obj[key] == null) {
        str += "null"
      } else if (typeof obj[key] == "object") {
        str += toJson(obj[key], level + 1);
      } else {
        str += "\"" + NormalizeString(obj[key]) + "\""
      }

    }

    str += "\n";
    str += indent(level - 1) + "}";
  }

  return str;
}

function GetSteamPath_Json() {
  return toJson(GetSteamPath());
}

function GetSteamPath() {
  var results = { details: {} };

  function TryRegistryKey(id, prefix, path) {  
    if (!results[id]) {
      results[id] = null;
    }
  
    try {
      var found_result = WShell.RegRead(path);
  
      if (!results[id]) {
        results[id] = found_result;
        results.details[id] = [];
      }

      results.details[id].push({ path: path, value: found_result })

    } catch (e) {
      // ignore
    }
  }

  // For completeness, this key will be present when Steam is installed on a 32 bit system.
  TryRegistryKey("SteamPath", "HKLM", "HKLM\\SOFTWARE\\Valve\\Steam\\InstallPath")
  
  // This is the preferred option.
  TryRegistryKey("SteamPath", "HKLM", "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam\\InstallPath") 
  
  // This option 
  TryRegistryKey("SteamPath", "HKCU", "HKCU\\SOFTWARE\\Valve\\Steam\\SteamPath") // May work even if RegRead fails on the HKLM key due to permissions

  return results;
}

function CollectionAsArray(collection) {
  var arr = [];

  for (var enumerator = new Enumerator(collection); !enumerator.atEnd(); enumerator.moveNext()) {
    arr[arr.length] = enumerator.item();
  }

  return arr;
}

function CollectAppManifests(paths) {
  var manifests = [];
  var nameMatcher = new RegExp("^appmanifest_([0-9]+)[.]acf$");

  for (var i = 0; i < paths.length; ++i) {
    var path    = paths[i];
    var folder  = FileSystemObject.GetFolder(path);
    var files   = CollectionAsArray(folder.Files);

    var commonDir = FileSystemObject.BuildPath(path, "common");

    for (var j = 0; j < files.length; ++j) {
      var file = files[j];
      var name = file.Name;
      var matched;

      if ((matched = nameMatcher.exec(name)) != null) {
        var appid = matched[1];
        var data = Vdf.Parse(file.OpenAsTextStream().ReadAll())["AppState"];
        manifests.push({ appid: appid, manifest: file.Path, name: data.name, gamePath: FileSystemObject.BuildPath(commonDir, data.installdir) });
      }
    }
  }  
  
  return manifests;
}

function GetSteamAppsPaths() {

  var results                 = GetSteamPath();
  var Steam_Path              = results.SteamPath
  // var SteamFolder          = FileSystemObject.GetFolder(Steam_Path);
  var SteamApps_Path          = FileSystemObject.BuildPath(Steam_Path, "steamapps")
  var LibraryFoldersFile_Path = FileSystemObject.BuildPath(SteamApps_Path, "libraryfolders.vdf")
  var SteamApps_PathArray     = [ SteamApps_Path ]

  if (!FileSystemObject.FolderExists(Steam_Path)) {
    throw new Error("steam folder does not exist")
  } 

  if (!FileSystemObject.FolderExists(SteamApps_Path)) {
    throw new Error("steamapps folder does not exist")
  }

  // collect additional library folders
  if (FileSystemObject.FileExists(LibraryFoldersFile_Path)) {
    var libraryFoldersData  = Vdf.Parse(FileSystemObject.GetFile(LibraryFoldersFile_Path).OpenAsTextStream().ReadAll());
    for (var i = 1; i < 99; ++i) {
      if (libraryFoldersData["LibraryFolders"][String(i)]) {
        var path = libraryFoldersData["LibraryFolders"][i];
        var alternate_steamapps = FileSystemObject.BuildPath(path, "steamapps");
        SteamApps_PathArray.push(alternate_steamapps)
      } else {
        break;
      }
    }
  }

  return SteamApps_PathArray;
}

function GetSteamGames() {

  var results                 = GetSteamPath();
  var Steam_Path              = results.SteamPath
  // var SteamFolder          = FileSystemObject.GetFolder(Steam_Path);
  var SteamApps_Path          = FileSystemObject.BuildPath(Steam_Path, "steamapps")
  var LibraryFoldersFile_Path = FileSystemObject.BuildPath(SteamApps_Path, "libraryfolders.vdf")
  var SteamApps_PathArray     = [ SteamApps_Path ]

  if (!FileSystemObject.FolderExists(Steam_Path)) {
    throw new Error("steam folder does not exist")
  } 

  if (!FileSystemObject.FolderExists(SteamApps_Path)) {
    throw new Error("steamapps folder does not exist")
  }

  // collect additional library folders
  if (FileSystemObject.FileExists(LibraryFoldersFile_Path)) {
    var libraryFoldersData  = Vdf.Parse(FileSystemObject.GetFile(LibraryFoldersFile_Path).OpenAsTextStream().ReadAll());
    for (var i = 1; i < 99; ++i) {
      if (libraryFoldersData["LibraryFolders"][String(i)]) {
        var path = libraryFoldersData["LibraryFolders"][i];
        var alternate_steamapps = FileSystemObject.BuildPath(path, "steamapps");
        SteamApps_PathArray.push(alternate_steamapps)
      } else {
        break;
      }
    }
  }

  return CollectAppManifests(SteamApps_PathArray);
}