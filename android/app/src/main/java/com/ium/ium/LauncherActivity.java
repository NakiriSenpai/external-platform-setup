/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package com.ium.ium;

/**
 * I:UM TWA launcher tunggal (PORTRAIT, dikunci di AndroidManifest).
 *
 * Tidak ada custom scheme, tidak ada Activity kedua, tidak ada reflection,
 * tidak ada CustomTabs binding manual, tidak ada setRequestedOrientation()
 * runtime. Seluruh navigasi ujian terjadi di dalam TWA yang sama.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
}
