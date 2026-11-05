/**
 * Arunachala Bhavan - Kitchen Order Ticket (KOT) Thermal Printer Service
 * Supports:
 *  1. Physical Connected Printers (USB, LAN, Wi-Fi thermal POS 80mm/58mm via silent iframe printing)
 *  2. Mobile Connected Printers (Bluetooth Thermal POS printers via Web Bluetooth ESC/POS)
 *  3. Auto-print queue to prevent duplicate printing
 */

// Storage Keys
const AUTO_PRINT_KEY = 'smart_rest_kitchen_autoprint_enabled';
const PAPER_SIZE_KEY = 'smart_rest_kitchen_paper_size'; // '80mm' or '58mm'
const PRINTED_ORDERS_KEY = 'smart_rest_kitchen_printed_orders';

class PrinterService {
  constructor() {
    this.bluetoothDevice = null;
    this.characteristic = null;
    this.isPrinting = false;
    this.printQueue = [];
    this.listeners = new Set();
  }

  // Subscribe to printer status changes (e.g. bluetooth connected/disconnected)
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.getStatus());
      } catch (e) {
        console.warn('Printer listener error:', e);
      }
    });
  }

  getStatus() {
    return {
      isBluetoothSupported: typeof navigator !== 'undefined' && Boolean(navigator.bluetooth),
      isBluetoothConnected: Boolean(this.bluetoothDevice && this.characteristic),
      bluetoothDeviceName: this.bluetoothDevice?.name || null,
      autoPrintEnabled: this.isAutoPrintEnabled(),
      paperSize: this.getPaperSize()
    };
  }

  // --- Configuration ---

  isAutoPrintEnabled() {
    try {
      const val = localStorage.getItem(AUTO_PRINT_KEY);
      return val === null ? true : val === 'true'; // Default enabled
    } catch {
      return true;
    }
  }

  setAutoPrintEnabled(enabled) {
    try {
      localStorage.setItem(AUTO_PRINT_KEY, String(Boolean(enabled)));
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save auto print setting:', e);
    }
  }

  getPaperSize() {
    try {
      return localStorage.getItem(PAPER_SIZE_KEY) || '80mm';
    } catch {
      return '80mm';
    }
  }

  setPaperSize(size) {
    try {
      localStorage.setItem(PAPER_SIZE_KEY, size === '58mm' ? '58mm' : '80mm');
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save paper size setting:', e);
    }
  }

  // --- Duplicate Print Tracking ---

  isOrderPrinted(orderId) {
    try {
      const list = JSON.parse(localStorage.getItem(PRINTED_ORDERS_KEY) || '[]');
      return list.includes(String(orderId));
    } catch {
      return false;
    }
  }

  markOrderPrinted(orderId) {
    if (!orderId) return;
    try {
      const list = JSON.parse(localStorage.getItem(PRINTED_ORDERS_KEY) || '[]');
      const strId = String(orderId);
      if (!list.includes(strId)) {
        list.push(strId);
        // Keep last 300 printed order IDs to manage storage
        const trimmed = list.slice(-300);
        localStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn('Failed to record printed order:', e);
    }
  }

  // --- Bluetooth ESC/POS Mobile Printer Support ---

  async connectBluetooth() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome/Edge or standard printer.');
    }

    try {
      // Common thermal printer service UUIDs
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
          { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '0000af30-0000-1000-8000-00805f9b34fb'
        ]
      }).catch(async () => {
        // Fallback: accept all devices if specific UUID filter is rejected
        return await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '0000af30-0000-1000-8000-00805f9b34fb'
          ]
        });
      });

      if (!device) throw new Error('No Bluetooth device selected');

      device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.bluetoothDevice = null;
        this.notifyListeners();
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      
      let foundCharacteristic = null;
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundCharacteristic = char;
              break;
            }
          }
          if (foundCharacteristic) break;
        } catch (e) {
          // continue checking other services
        }
      }

      if (!foundCharacteristic) {
        throw new Error('Could not find writable printer characteristic on the selected Bluetooth device.');
      }

      this.bluetoothDevice = device;
      this.characteristic = foundCharacteristic;
      this.notifyListeners();
      return device.name || 'Bluetooth Printer';
    } catch (err) {
      this.characteristic = null;
      this.bluetoothDevice = null;
      this.notifyListeners();
      throw err;
    }
  }

  disconnectBluetooth() {
    try {
      if (this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
        this.bluetoothDevice.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Disconnect error:', e);
    } finally {
      this.bluetoothDevice = null;
      this.characteristic = null;
      this.notifyListeners();
    }
  }

  // --- ESC/POS Binary Command Generator (Mobile Bluetooth) ---

  buildEscPosKOT(order) {
    const encoder = new TextEncoder();
    const bytes = [];

    // Helpers
    const append = (arr) => {
      for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
    };
    const text = (str) => {
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
    };

    // ESC @ : Initialize
    append([0x1B, 0x40]);

    // Center Align
    append([0x1B, 0x61, 0x01]);

    // Double-Height + Bold Title
    append([0x1B, 0x21, 0x30]); // Double width/height
    text("ARUNACHALA BHAVAN\n");
    append([0x1B, 0x21, 0x00]); // Normal
    text("PURE VEGETARIAN\n");
    text("--------------------------------\n");

    // Double Height KOT Header
    append([0x1B, 0x21, 0x10]); // Double height
    text("*** KITCHEN ORDER TICKET (KOT) ***\n");
    append([0x1B, 0x21, 0x00]);
    text("================================\n");

    // Left Align
    append([0x1B, 0x61, 0x00]);

    const isDelivery = order.order_type === 'HOME_DELIVERY' || Number(order.table_number) === 0 || Boolean(order.delivery_address);
    const tableText = isDelivery ? "HOME DELIVERY" : `TABLE: T-${String(order.table_number || '01').padStart(2, '0')}`;
    
    // Large Table/Order Type
    append([0x1B, 0x21, 0x20]); // Double width
    append([0x1B, 0x45, 0x01]); // Bold on
    text(`${tableText}\n`);
    append([0x1B, 0x45, 0x00]); // Bold off
    append([0x1B, 0x21, 0x00]); // Normal

    text(`Order #   : ${order.order_number || order.id || 'N/A'}\n`);
    const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
    text(`Time      : ${dateStr}\n`);
    
    if (order.customer_name) {
      text(`Customer  : ${order.customer_name}\n`);
    }
    if (order.phone_number) {
      text(`Phone     : ${order.phone_number}\n`);
    }
    if (isDelivery && order.delivery_address) {
      text(`Address   : ${order.delivery_address}\n`);
    }

    text("--------------------------------\n");
    append([0x1B, 0x45, 0x01]); // Bold on
    text("QTY   ITEM DESCRIPTION\n");
    append([0x1B, 0x45, 0x00]); // Bold off
    text("--------------------------------\n");

    const rawItems = Array.isArray(order.items) 
      ? order.items 
      : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);

    let totalQty = 0;
    rawItems.forEach(item => {
      const qty = Number(item.quantity || item.qty || 1);
      totalQty += qty;
      const name = item.item_name || item.name || 'Dish Item';

      append([0x1B, 0x45, 0x01]); // Bold
      text(`[${qty}]  ${name}\n`);
      append([0x1B, 0x45, 0x00]);

      if (item.special_instruction || item.instructions) {
        text(`     * Note: ${item.special_instruction || item.instructions}\n`);
      }
    });

    text("--------------------------------\n");
    append([0x1B, 0x45, 0x01]);
    text(`TOTAL ITEMS: ${totalQty}\n`);
    append([0x1B, 0x45, 0x00]);

    if (order.notes) {
      text(`Chef Note  : "${order.notes}"\n`);
    }

    // Footer & Linefeeds
    append([0x1B, 0x61, 0x01]); // Center
    text("================================\n");
    text("*** PREPARE FRESH & HOT ***\n");
    text("================================\n\n\n\n");

    // Partial cut command: GS V 66 0
    append([0x1D, 0x56, 0x42, 0x00]);

    return new Uint8Array(bytes);
  }

  async sendBluetoothBytes(byteArray) {
    if (!this.characteristic) throw new Error('Bluetooth printer not connected');
    const chunkSize = 128;
    for (let i = 0; i < byteArray.length; i += chunkSize) {
      const chunk = byteArray.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
      // Brief pause to prevent buffer overflow on mobile microcontrollers
      await new Promise(r => setTimeout(r, 20));
    }
  }

  // --- Physical Printer & Browser Thermal Printing (Hidden Iframe) ---

  generateThermalKOTHTML(order) {
    const paperSize = this.getPaperSize();
    const widthMm = paperSize === '58mm' ? '54mm' : '76mm';
    const isDelivery = order.order_type === 'HOME_DELIVERY' || Number(order.table_number) === 0 || Boolean(order.delivery_address);
    const tableText = isDelivery ? 'HOME DELIVERY' : `TABLE T-${String(order.table_number || '01').padStart(2, '0')}`;
    const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    const rawItems = Array.isArray(order.items) 
      ? order.items 
      : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);

    let totalQty = 0;
    const itemsRows = rawItems.map(item => {
      const qty = Number(item.quantity || item.qty || 1);
      totalQty += qty;
      const name = item.item_name || item.name || 'Dish Item';
      const instruction = item.special_instruction || item.instructions;

      return `
        <tr style="border-bottom: 1px dashed #000;">
          <td style="padding: 5px 0; vertical-align: top; width: 38px; font-size: 15px; font-weight: 900;">
            [×${qty}]
          </td>
          <td style="padding: 5px 0; vertical-align: top;">
            <div style="font-size: 14px; font-weight: 800; text-transform: uppercase;">${name}</div>
            ${instruction ? `<div style="font-size: 11px; font-style: italic; color: #222; margin-top: 2px;">Note: "${instruction}"</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>KOT - ${order.order_number || order.id}</title>
        <style>
          @page {
            size: ${paperSize === '58mm' ? '58mm auto' : '80mm auto'};
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            width: ${widthMm};
            margin: 0 auto;
            padding: 8px 6px;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.25;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: 900; }
          .divider { border-top: 1px solid #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .dashed-divider { border-top: 1px dashed #000; margin: 5px 0; }
          .badge {
            display: inline-block;
            background: #000;
            color: #fff;
            padding: 3px 6px;
            font-size: 15px;
            font-weight: 900;
            margin: 4px 0;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">ARUNACHALA BHAVAN</div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Pure Vegetarian • Temple of Taste</div>
          <div class="divider"></div>
          <div style="font-size: 13px; font-weight: 900; margin: 3px 0;">KITCHEN ORDER TICKET (KOT)</div>
          <div class="badge">${tableText}</div>
          <div class="double-divider"></div>
        </div>

        <div style="font-size: 11px; margin-bottom: 4px;">
          <div><strong>Order #  :</strong> ${order.order_number || order.id || 'N/A'}</div>
          <div><strong>Time     :</strong> ${dateStr}</div>
          ${order.customer_name ? `<div><strong>Customer :</strong> ${order.customer_name}</div>` : ''}
          ${order.phone_number ? `<div><strong>Phone    :</strong> ${order.phone_number}</div>` : ''}
          ${isDelivery && order.delivery_address ? `<div><strong>Address  :</strong> ${order.delivery_address}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1.5px solid #000; font-size: 11px;">
              <th style="padding-bottom: 3px; width: 38px;">QTY</th>
              <th style="padding-bottom: 3px;">ITEM DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900;">
          <span>TOTAL ITEMS:</span>
          <span>${totalQty}</span>
        </div>

        ${order.notes ? `
          <div class="dashed-divider"></div>
          <div style="font-size: 11px; font-weight: 700;">CHEF NOTE: "${order.notes}"</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center" style="font-size: 11px; font-weight: 800; margin-top: 4px;">
          *** PREPARE FRESH &amp; HOT ***
        </div>
        <div style="height: 25px;"></div>
      </body>
      </html>
    `;
  }

  printViaIframe(htmlContent) {
    return new Promise((resolve) => {
      let iframe = document.getElementById('kot-thermal-print-frame');
      if (iframe) {
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
      }

      iframe = document.createElement('iframe');
      iframe.id = 'kot-thermal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve(true);
          } catch (e) {
            console.warn('Iframe print error:', e);
            resolve(false);
          }
        }, 200);
      };
    });
  }

  // --- Main Unified Print Dispatcher ---

  async printKOT(order, { forceSystemPrint = false, isTest = false } = {}) {
    if (!order) return { success: false, message: 'Invalid order' };

    // 1. If Bluetooth printer is connected and user didn't force system print:
    if (this.characteristic && !forceSystemPrint) {
      try {
        const escPosBytes = this.buildEscPosKOT(order);
        await this.sendBluetoothBytes(escPosBytes);
        if (!isTest) {
          this.markOrderPrinted(order.id || order.order_number);
        }
        return { success: true, method: 'bluetooth', device: this.bluetoothDevice?.name || 'Bluetooth Printer' };
      } catch (err) {
        console.warn('Bluetooth print failed, falling back to thermal iframe print:', err);
      }
    }

    // 2. Physical Connected Printer / Mobile System Print via Thermal Iframe
    try {
      const html = this.generateThermalKOTHTML(order);
      await this.printViaIframe(html);
      if (!isTest) {
        this.markOrderPrinted(order.id || order.order_number);
      }
      return { success: true, method: 'physical' };
    } catch (err) {
      console.error('Physical / System print failed:', err);
      return { success: false, error: err.message };
    }
  }

  // Sample KOT for printer testing
  printTestKOT() {
    const sampleOrder = {
      id: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
      order_number: 'KOT' + Math.floor(1000 + Math.random() * 9000),
      table_number: 1,
      order_type: 'DINE_IN',
      customer_name: 'Printer Self-Test',
      phone_number: '+91 98765 43210',
      created_at: new Date().toISOString(),
      notes: 'Test print from Kitchen Display System',
      items: [
        { item_name: 'Ghee Roast Special Dosa', quantity: 2, special_instruction: 'Extra crispy' },
        { item_name: 'Filter Coffee (Degree)', quantity: 2, special_instruction: 'Strong' },
        { item_name: 'Idli Sambar Dip (2 Pcs)', quantity: 1 }
      ]
    };
    return this.printKOT(sampleOrder, { isTest: true });
  }
}

export const printerService = new PrinterService();
