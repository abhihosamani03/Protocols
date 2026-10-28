# Interactive Flow Control Protocol Simulator
An interactive, visual simulation and benchmarking tool for sliding window flow control protocols.

---

## 📌 Project Overview
This project is an interactive, visual simulation tool developed to demonstrate and analyze the performance of three fundamental sliding window flow control protocols under configurable network conditions:
1. **One-Bit Sliding Window (Stop-and-Wait)**
2. **Go-Back-N (GBN)**
3. **Selective Repeat (SR)**

---

## 🚀 How to Run the Simulator

### Option 1: Direct in Browser
Simply open **`index.html`** in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Brave, Safari, etc.). No backend, installation, or server is required!

### Option 2: Local HTTP Server (Optional)
If you prefer running through a local server:
```bash
npx serve .
# or
python -m http.server 8000
```
Then visit `http://localhost:8000`.

---

## 🎛️ Key Features

### 1. Configurable Network Parameters
- **Protocol Selector:** Switch between One-Bit SW, Go-Back-N, and Selective Repeat.
- **Window Size ($N$):** Configurable from 1 to 16 (automatically locked to 1 for One-Bit SW).
- **Number of Packets/Frames ($M$):** Configurable frame count (10, 20, 30, etc.).
- **Transmission Delay ($T_t$):** Simulated frame propagation delay in ms.
- **ACK Delay ($T_{ack}$):** Simulated acknowledgement return delay in ms.
- **Packet Loss Rate (%):** Configurable drop rate (0% to 80%).
- **ACK Loss Rate (%):** Configurable ACK drop rate (0% to 80%).
- **Timeout Period ($T_{out}$):** Timer expiration interval before retransmission in ms.

### 2. Interactive Channel Animation & Manual Drops
- Real-time animated packets and ACKs traveling across the full-duplex transmission channel.
- **Interactive Manual Drop:** You can click on any packet or ACK while it is in flight to force-drop it, allowing live demonstration of loss scenarios.
- Clear visual cues for normal packets, retransmitted packets, and dropped packets with red "LOST" badges.

### 3. Space-Time Sequence (Ladder) Canvas
- Live vertical spacetime ladder diagram displaying transmission lines and timing.
- Slanted vector arrows showing frame transmissions and ACK returns.
- Visual **"X (LOST)"** break points showing where frames or ACKs were dropped.
- Timeout event markers and retransmission bursts.

### 4. Live Sliding Window Visualizers
- **Sender Window:** Color-coded status for each sequence number (Acknowledged, In-Flight, Usable in Window, Queued) with active window highlight and `BASE` pointer.
- **Receiver Window:** Shows delivered packets, out-of-order buffered packets (Selective Repeat), and expected receive window with `RCV_BASE` pointer.

### 5. Multi-Protocol Performance Benchmark
- One-click benchmark running One-Bit SW, Go-Back-N, and Selective Repeat under identical network parameters.
- Outputs side-by-side comparison cards and summary text:
  - Total frames transmitted
  - Number of retransmissions
  - Packets lost
  - ACKs received
  - Total transmission time
  - Throughput (fps)
  - Efficiency ($\eta$) %
- Interactive Chart.js comparative bar chart.

---

## 📂 Project Structure
```
├── index.html               # Main user interface & interactive lab
├── css/
│   └── styles.css           # Styling, dark mode aesthetic, animations
├── js/
│   ├── protocol-engine.js   # Discrete-event flow control protocol engine
│   ├── visualizer.js        # Canvas ladder diagram & DOM flight animations
│   └── app.js               # UI orchestration, metrics, & Chart.js integration
├── .gitignore               # Ignored files
└── README.md                # Documentation & usage guide
```
