# steam-detect

This mini-project uses Windows Script Host to interrogate a steam installation 
on a Windows machine. 

It checks the Windows Registry to locate the Steam home folder, then uses 
`libraryfolders.vdf` to identify any alternate drive library folders.

Finally, it can parse all appmanifest files in all library folders to return 
the appid, name, and installation directory for all steam games currently
downloaded onto the machine.

## Usage

These scripts are meant to be invoked by other applications to locate the 
install directory for games, but they can be invoked from any windows command 
line.

- `cscript steam.wsf` will give you the Steam directory.
- `cscript steam.wsf \\Job:SteamAppsPaths` will list all steamapps folders.
- `cscript steam.wsf \\Job:SteamGames` will list all installed games.

Note that this script must be run within the Windows Script Host, as it uses 
its API to make registry and filesystem calls. 

## vdf.js

This file implements a very loose parser for Valve's KeyValue format. This is 
the file format used by `libraryfolders.vdf`, as well as all 
`appmanifest_XXXX.acf` files. It is not tied to Windows Script Host, and since 
Window's Active JScript implementation hasn't been updated since IE6 or so it
should run in any modern (or non-modern) Javascript engine.