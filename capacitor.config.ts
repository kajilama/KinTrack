import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kintrack.family',
  appName: 'KinTrack Family',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'ais-pre-64zkshl45xh2tm6desmgrb-509508212277.us-west1.run.app',
      'ais-dev-64zkshl45xh2tm6desmgrb-509508212277.us-west1.run.app',
      'nominatim.openstreetmap.org',
      '*.tile.openstreetmap.org',
      'server.arcgisonline.com',
      '*',
    ],
  },
  plugins: {
    Geolocation: {},
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0b1120',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
