#!/usr/bin/gjs

imports.searchPath.push(
  `${GLib.get_current_dir()}/dist`
);

import "./bundle.js";
