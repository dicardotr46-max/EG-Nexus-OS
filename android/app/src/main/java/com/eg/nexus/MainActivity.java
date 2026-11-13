package com.eg.nexus;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NexusKeystorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
