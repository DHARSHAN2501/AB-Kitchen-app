import React, { useState, useEffect } from 'react';
import { printerService } from '../services/printerService';
import { showToast } from './Toast';
import { 
  Printer, 
  Bluetooth, 
  CheckCircle2, 
  X, 
  Settings, 
  Volume2, 
  VolumeX, 
  FileText, 
  AlertCircle, 
  HelpCircle,
  Sparkles,
  Smartphone
} from 'lucide-react';

export const PrinterSettingsModal = ({ isOpen, onClose, soundEnabled, setSoundEnabled }) => {
  const [printerStatus, setPrinterStatus] = useState(() => printerService.getStatus());
  const [connectingBt, setConnectingBt] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const unsub = printerService.subscribe((newStatus) => {
      setPrinterStatus(newStatus);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleToggleAutoPrint = () => {
    const nextVal = !printerStatus.autoPrintEnabled;
    printerService.setAutoPrintEnabled(nextVal);
    setPrinterStatus(prev => ({ ...prev, autoPrintEnabled: nextVal }));
    const msg = nextVal ? 'Auto-print enabled for incoming orders' : 'Auto-print disabled';
    setFeedback({ type: 'success', text: `✓ ${msg}` });
    showToast({ title: 'Saved', message: msg, variant: 'success' });
  };

  const handleSelectPaper = (size) => {
    printerService.setPaperSize(size);
    setPrinterStatus(prev => ({ ...prev, paperSize: size }));
    const msg = `Thermal paper width saved (${size})`;
    setFeedback({ type: 'success', text: `✓ ${msg}` });
    showToast({ title: 'Updated', message: msg, variant: 'success' });
  };

  const handleConnectBluetooth = async () => {
    setConnectingBt(true);
    setFeedback(null);
    try {
      const name = await printerService.connectBluetooth();
      const msg = `Connected to mobile Bluetooth printer: ${name}`;
      setFeedback({ type: 'success', text: `✓ ${msg}` });
      showToast({ title: 'Saved', message: msg, variant: 'success' });
    } catch (err) {
      if (err.name !== 'NotFoundError') { // User didn't just cancel picker
        const errMsg = err.message || 'Could not connect to Bluetooth printer';
        setFeedback({ type: 'error', text: errMsg });
        showToast({ title: 'Error', message: errMsg, variant: 'danger' });
      }
    } finally {
      setConnectingBt(false);
    }
  };

  const handleDisconnectBluetooth = () => {
    printerService.disconnectBluetooth();
    setFeedback({
      type: 'info',
      text: 'Bluetooth printer disconnected'
    });
    showToast({ title: 'Updated', message: 'Bluetooth printer disconnected.', variant: 'info' });
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    setFeedback(null);
    try {
      const res = await printerService.printTestKOT();
      if (res.success) {
        const msg = res.method === 'bluetooth'
          ? 'Test KOT sent to Bluetooth printer!'
          : 'Test KOT sent to physical printer!';
        setFeedback({ type: 'success', text: `✓ ${msg}` });
        showToast({ title: 'Completed', message: msg, variant: 'success' });
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Test print failed'
        });
        showToast({ title: 'Error', message: res.error || 'Test print failed', variant: 'danger' });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Test print failed'
      });
      showToast({ title: 'Error', message: err.message || 'Test print failed', variant: 'danger' });
    } finally {
      setTestingPrint(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Kitchen Printer Hub</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </h3>
              <p className="text-xs text-blue-200/80 font-medium">Automatic KOT Printing for Physical &amp; Mobile Devices</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-800">
          
          {/* Notification Feedback Banner */}
          {feedback && (
            <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              feedback.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Section 1: Auto-Print Incoming Orders Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900">Auto-Print Incoming Orders</span>
                {printerStatus.autoPrintEnabled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider animate-pulse">
                    Live Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically prints KOT ticket when a new customer order arrives
              </p>
            </div>

            <button
              onClick={handleToggleAutoPrint}
              className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer relative ${
                printerStatus.autoPrintEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  printerStatus.autoPrintEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Section 2: Audio Chime Alert */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900">New Order Audio Chime</span>
                {soundEnabled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 uppercase tracking-wider">
                    Sound ON
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Plays loud chime alert when a new order is received
              </p>
            </div>

            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                const msg = next ? 'New order audio chime enabled' : 'New order audio chime muted';
                setFeedback({ type: 'success', text: `✓ ${msg}` });
                showToast({ title: 'Updated', message: msg, variant: 'success' });
              }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Enabled' : 'Muted'}</span>
            </button>
          </div>

          {/* Section 3: Paper Width Configuration */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-2">
              Thermal Paper Width
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectPaper('80mm')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                  printerStatus.paperSize === '80mm'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-sm text-slate-900">80mm (Standard POS)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Physical USB / LAN / Wi-Fi thermal printers</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPaper('58mm')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                  printerStatus.paperSize === '58mm'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-sm text-slate-900">58mm (Compact)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Mobile Bluetooth thermal receipt printers</div>
              </button>
            </div>
          </div>

          {/* Section 4: Device Connections (Physical & Mobile Bluetooth) */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Connected Devices
            </label>

            {/* Device 1: Physical Desktop/POS Thermal Printer */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <span>Physical Desktop Printer (USB / LAN / Wi-Fi)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Works automatically via system print &amp; POS silent print
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 whitespace-nowrap">
                ✓ Ready
              </span>
            </div>

            {/* Device 2: Mobile Bluetooth Thermal Printer */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  printerStatus.isBluetoothConnected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <span>Mobile Bluetooth Thermal Printer</span>
                    {printerStatus.isBluetoothConnected && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {printerStatus.isBluetoothConnected 
                      ? `Paired: ${printerStatus.bluetoothDeviceName}` 
                      : (printerStatus.isBluetoothSupported ? 'Ready to pair mobile printer' : 'Standard print fallback active')}
                  </div>
                </div>
              </div>

              {printerStatus.isBluetoothConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectBluetooth}
                  className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  disabled={connectingBt || !printerStatus.isBluetoothSupported}
                  className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{connectingBt ? 'Searching...' : 'Pair Printer'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 5: Silent Printing Pro Tip */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1">
            <div className="font-black flex items-center gap-1.5 text-amber-950">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Pro Tip: 100% Silent Zero-Click Physical Printing</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              To auto-print physically without any browser popup, launch Chrome or Edge with: <br />
              <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-950 select-all">
                --kiosk-printing
              </code>
              <br />
              The physical thermal printer will print tickets automatically in the background!
            </p>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={testingPrint}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>{testingPrint ? 'Printing Sample...' : 'Print Test KOT'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              showToast({
                title: 'Saved',
                message: 'Kitchen printer settings saved.',
                variant: 'success'
              });
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-6 rounded-xl text-xs transition cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
          >
            Save &amp; Close
          </button>
        </div>

      </div>
    </div>
  );
};
