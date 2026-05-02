import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PWADebugger() {
  const [info, setInfo] = useState({
    isStandalone: false,
    isIOS: false,
    userAgent: '',
    hasBeforeInstallPrompt: false,
    displayMode: '',
    sessions: 0,
    lastDismissed: '',
    canInstall: false
  });

  useEffect(() => {
    // Check standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const standaloneNav = (window.navigator as any).standalone;
    
    // Check iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Get display mode
    let displayMode = 'browser';
    if (standalone) displayMode = 'standalone';
    if ((window.navigator as any).standalone) displayMode = 'standalone (iOS)';
    
    // Get sessions
    const sessions = parseInt(localStorage.getItem('pwa-sessions') || '0');
    
    // Get last dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const lastDismissed = dismissed 
      ? new Date(parseInt(dismissed)).toLocaleString()
      : 'Never';
    
    // Determine if can install
    const canInstall = !standalone && (!dismissed || 
      (Date.now() - parseInt(dismissed || '0')) / (1000 * 60 * 60 * 24) > 7);

    setInfo({
      isStandalone: standalone || standaloneNav,
      isIOS: ios,
      userAgent: navigator.userAgent,
      hasBeforeInstallPrompt: false, // Will be updated by event
      displayMode,
      sessions,
      lastDismissed,
      canInstall
    });

    // Listen for beforeinstallprompt
    const handler = () => {
      console.log('✅ beforeinstallprompt event detected!');
      setInfo(prev => ({ ...prev, hasBeforeInstallPrompt: true, canInstall: true }));
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const getStatus = () => {
    if (info.isStandalone) {
      return { text: '✅ Already Installed', color: 'text-green-600', bg: 'bg-green-50' };
    }
    if (info.canInstall) {
      return { text: '🎯 Can Install', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    return { text: '⏸️ Not Ready', color: 'text-yellow-600', bg: 'bg-yellow-50' };
  };

  const status = getStatus();

  return (
    <Card className="mt-4 border-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          🔧 PWA Installation Debugger
          <span className={`text-sm px-3 py-1 rounded-full ${status.bg} ${status.color}`}>
            {status.text}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Display Mode:</span>
              <div className={`mt-1 px-2 py-1 rounded ${info.isStandalone ? 'bg-green-100' : 'bg-gray-100'}`}>
                {info.displayMode}
              </div>
            </div>
            
            <div>
              <span className="font-semibold">Device Type:</span>
              <div className="mt-1 px-2 py-1 rounded bg-gray-100">
                {info.isIOS ? '🍎 iOS' : '🤖 Android/Desktop'}
              </div>
            </div>
            
            <div>
              <span className="font-semibold">Install Event:</span>
              <div className={`mt-1 px-2 py-1 rounded ${info.hasBeforeInstallPrompt ? 'bg-green-100' : 'bg-gray-100'}`}>
                {info.hasBeforeInstallPrompt ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <span className="font-semibold">Sessions (iOS):</span>
              <div className="mt-1 px-2 py-1 rounded bg-gray-100">
                {info.sessions} {info.isIOS && info.sessions < 3 && '(need 3+)'}
              </div>
            </div>
            
            <div>
              <span className="font-semibold">Last Dismissed:</span>
              <div className="mt-1 px-2 py-1 rounded bg-gray-100 text-xs">
                {info.lastDismissed}
              </div>
            </div>
            
            <div>
              <span className="font-semibold">Can Show Prompt:</span>
              <div className={`mt-1 px-2 py-1 rounded ${info.canInstall ? 'bg-green-100' : 'bg-gray-100'}`}>
                {info.canInstall ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          </div>
        </div>

        <div>
          <span className="font-semibold text-sm">User Agent:</span>
          <div className="mt-1 px-2 py-1 rounded bg-gray-100 text-xs break-all">
            {info.userAgent}
          </div>
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs font-semibold mb-2">📊 Console Logs:</p>
          <p className="text-xs text-gray-600">
            Open browser DevTools (F12) and check Console tab for detailed PWA logs.
            Look for messages starting with 🔧, 📱, 🍎, etc.
          </p>
        </div>

        {info.isStandalone && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800">✅ PWA Successfully Installed!</p>
            <p className="text-xs text-green-700 mt-1">
              App is running in standalone mode. No browser tabs visible.
            </p>
          </div>
        )}

        {!info.isStandalone && info.isIOS && info.sessions < 3 && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-800">📱 iOS - Need More Sessions</p>
            <p className="text-xs text-blue-700 mt-1">
              Visit {3 - info.sessions} more time(s) to see the install prompt on iOS.
            </p>
          </div>
        )}

        {!info.isStandalone && !info.isIOS && !info.hasBeforeInstallPrompt && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-semibold text-yellow-800">⚠️ Install Event Not Fired</p>
            <p className="text-xs text-yellow-700 mt-1">
              The beforeinstallprompt event hasn't fired yet. This is normal on first load.
              Try refreshing the page or visiting from a different URL (e.g., localhost instead of IP).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
