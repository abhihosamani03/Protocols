/**
 * Application Controller
 * Handles UI interactions, simulation loop, protocol comparison, and Chart.js integration
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const protocolSelect = document.getElementById('protocolSelect');
  const windowSizeInput = document.getElementById('windowSizeInput');
  const windowSizeGroup = document.getElementById('windowSizeGroup');
  const totalFramesInput = document.getElementById('totalFramesInput');
  const transmissionDelayInput = document.getElementById('transmissionDelayInput');
  const ackDelayInput = document.getElementById('ackDelayInput');
  const packetLossInput = document.getElementById('packetLossInput');
  const ackLossInput = document.getElementById('ackLossInput');
  const timeoutInput = document.getElementById('timeoutInput');

  // Value Display Labels
  const packetLossVal = document.getElementById('packetLossVal');
  const ackLossVal = document.getElementById('ackLossVal');
  const transDelayVal = document.getElementById('transDelayVal');
  const ackDelayVal = document.getElementById('ackDelayVal');
  const timeoutVal = document.getElementById('timeoutVal');

  // Control Buttons
  const btnStartPause = document.getElementById('btnStartPause');
  const btnStep = document.getElementById('btnStep');
  const btnReset = document.getElementById('btnReset');
  const speedSlider = document.getElementById('speedSlider');
  const speedVal = document.getElementById('speedVal');
  const btnRunComparison = document.getElementById('btnRunComparison');

  // Metric Displays
  const statTotalTransmitted = document.getElementById('statTotalTransmitted');
  const statRetransmissions = document.getElementById('statRetransmissions');
  const statPacketsLost = document.getElementById('statPacketsLost');
  const statAcksReceived = document.getElementById('statAcksReceived');
  const statSimTime = document.getElementById('statSimTime');
  const statThroughput = document.getElementById('statThroughput');
  const statEfficiency = document.getElementById('statEfficiency');
  const currentProtocolBadge = document.getElementById('currentProtocolBadge');

  // Visualizer Containers
  const channelContainer = document.getElementById('channelAnimationBox');
  const senderWindowEl = document.getElementById('senderWindowBox');
  const receiverWindowEl = document.getElementById('receiverWindowBox');
  const ladderCanvas = document.getElementById('ladderCanvas');
  const ladderScrollContainer = document.getElementById('ladderScrollContainer');
  const eventLogBody = document.getElementById('eventLogBody');

  // State
  let engine = null;
  let visualizer = null;
  let isRunning = false;
  let simSpeed = 1.0;
  let lastTimestamp = 0;
  let comparisonChart = null;

  // Initialize Engine with Form Inputs
  function getFormConfig() {
    return {
      protocol: protocolSelect.value,
      windowSize: parseInt(windowSizeInput.value, 10),
      totalFrames: parseInt(totalFramesInput.value, 10),
      transmissionDelay: parseInt(transmissionDelayInput.value, 10),
      ackDelay: parseInt(ackDelayInput.value, 10),
      packetLossRate: parseFloat(packetLossInput.value),
      ackLossRate: parseFloat(ackLossInput.value),
      timeout: parseInt(timeoutInput.value, 10)
    };
  }

  function initSimulation() {
    isRunning = false;
    updatePlayButtonUI();

    const config = getFormConfig();
    engine = new ProtocolEngine(config);

    if (!visualizer) {
      visualizer = new Visualizer(engine, {
        channelContainer,
        senderWindowEl,
        receiverWindowEl,
        ladderCanvas,
        ladderScrollContainer
      });
    } else {
      visualizer.setEngine(engine);
    }

    // Update Protocol UI Badge
    if (currentProtocolBadge) {
      currentProtocolBadge.textContent = engine.getProtocolName();
    }

    updateMetricsUI();
    renderEventLogs();
    visualizer.render();
  }

  // Handle Protocol Change UI (e.g. Window Size is 1 for One-Bit)
  protocolSelect.addEventListener('change', () => {
    if (protocolSelect.value === 'one-bit') {
      windowSizeInput.value = '1';
      windowSizeInput.disabled = true;
      windowSizeGroup.classList.add('opacity-50');
    } else {
      if (windowSizeInput.value === '1') windowSizeInput.value = '4';
      windowSizeInput.disabled = false;
      windowSizeGroup.classList.remove('opacity-50');
    }
    initSimulation();
  });

  // Slider input updates
  packetLossInput.addEventListener('input', (e) => {
    packetLossVal.textContent = `${e.target.value}%`;
    if (engine) engine.packetLossRate = parseFloat(e.target.value) / 100;
  });

  ackLossInput.addEventListener('input', (e) => {
    ackLossVal.textContent = `${e.target.value}%`;
    if (engine) engine.ackLossRate = parseFloat(e.target.value) / 100;
  });

  transmissionDelayInput.addEventListener('input', (e) => {
    transDelayVal.textContent = `${e.target.value} ms`;
    if (engine) engine.transmissionDelay = parseInt(e.target.value, 10);
  });

  ackDelayInput.addEventListener('input', (e) => {
    ackDelayVal.textContent = `${e.target.value} ms`;
    if (engine) engine.ackDelay = parseInt(e.target.value, 10);
  });

  timeoutInput.addEventListener('input', (e) => {
    timeoutVal.textContent = `${e.target.value} ms`;
    if (engine) engine.timeout = parseInt(e.target.value, 10);
  });

  speedSlider.addEventListener('input', (e) => {
    simSpeed = parseFloat(e.target.value);
    speedVal.textContent = `${simSpeed}x`;
  });

  [windowSizeInput, totalFramesInput].forEach(inp => {
    inp.addEventListener('change', () => initSimulation());
  });

  // Play / Pause
  btnStartPause.addEventListener('click', () => {
    if (engine.isCompleted) {
      initSimulation();
    }
    isRunning = !isRunning;
    updatePlayButtonUI();
    if (isRunning) {
      lastTimestamp = performance.now();
      requestAnimationFrame(animationLoop);
    }
  });

  // Step button
  btnStep.addEventListener('click', () => {
    if (isRunning) {
      isRunning = false;
      updatePlayButtonUI();
    }
    engine.step(20);
    updateMetricsUI();
    renderEventLogs();
    visualizer.render();
  });

  // Reset button
  btnReset.addEventListener('click', () => {
    initSimulation();
  });

  function updatePlayButtonUI() {
    if (isRunning) {
      btnStartPause.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Pause</span>
      `;
      btnStartPause.className = 'px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-lg shadow-amber-500/20 active:scale-95';
    } else {
      btnStartPause.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>${engine && engine.isCompleted ? 'Restart' : 'Start Simulation'}</span>
      `;
      btnStartPause.className = 'px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 active:scale-95';
    }
  }

  // Animation Loop
  function animationLoop(timestamp) {
    if (!isRunning) return;

    const deltaRealMs = Math.min(100, timestamp - (lastTimestamp || timestamp));
    lastTimestamp = timestamp;

    // Simulation advances by scaled time
    const simDt = deltaRealMs * simSpeed;
    engine.step(simDt);

    updateMetricsUI();
    renderEventLogs();
    visualizer.render();

    if (engine.isCompleted) {
      isRunning = false;
      updatePlayButtonUI();
      return;
    }

    requestAnimationFrame(animationLoop);
  }

  // UI Metrics Update
  function updateMetricsUI() {
    const s = engine.stats;
    statTotalTransmitted.textContent = s.totalTransmitted;
    statRetransmissions.textContent = s.retransmissions;
    statPacketsLost.textContent = s.packetsLost;
    statAcksReceived.textContent = s.acksReceived;
    statSimTime.textContent = `${(s.totalSimulationTime).toFixed(0)} ms`;
    statThroughput.textContent = `${s.throughput} fps`;
    statEfficiency.textContent = `${s.efficiency}%`;
  }

  // Event Log Rendering
  function renderEventLogs() {
    if (!eventLogBody) return;
    const recent = engine.events.slice(-30).reverse();
    eventLogBody.innerHTML = recent.map(ev => {
      let badgeClass = 'bg-slate-700 text-slate-200';
      if (ev.type === 'send') badgeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      if (ev.type === 'success') badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      if (ev.type === 'warning') badgeClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      if (ev.type === 'danger' || ev.type === 'timeout') badgeClass = 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold';
      if (ev.type === 'complete') badgeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold';

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
          <td class="py-1.5 px-3 font-mono text-slate-400 whitespace-nowrap">${ev.time.toFixed(0)}ms</td>
          <td class="py-1.5 px-3 font-semibold text-slate-300">${ev.source}</td>
          <td class="py-1.5 px-3">
            <span class="inline-block px-2 py-0.5 rounded text-[11px] ${badgeClass}">${ev.message}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Multi-Protocol Comparison Runner
  btnRunComparison.addEventListener('click', () => {
    runComparisonExperiment();
  });

  function runComparisonExperiment() {
    const baseConfig = getFormConfig();
    const winSize = Math.max(2, parseInt(windowSizeInput.value, 10) || 4);

    // 1. One-Bit Sliding Window
    const oneBitSim = new ProtocolEngine({
      ...baseConfig,
      protocol: 'one-bit',
      windowSize: 1
    });
    const oneBitRes = oneBitSim.runToCompletion();

    // 2. Go-Back-N
    const gbnSim = new ProtocolEngine({
      ...baseConfig,
      protocol: 'gbn',
      windowSize: winSize
    });
    const gbnRes = gbnSim.runToCompletion();

    // 3. Selective Repeat
    const srSim = new ProtocolEngine({
      ...baseConfig,
      protocol: 'sr',
      windowSize: winSize
    });
    const srRes = srSim.runToCompletion();

    // Render comparison cards (matching exact PDF format)
    const compareCard = document.getElementById('comparisonSummaryCard');
    compareCard.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- One Bit -->
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-sm text-sky-400">One-Bit SW</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">Window: 1</span>
            </div>
            <div class="space-y-1 text-xs text-slate-300 font-mono mt-3">
              <div class="flex justify-between"><span>Retransmissions:</span> <span class="font-bold text-amber-400">${oneBitRes.retransmissions}</span></div>
              <div class="flex justify-between"><span>Packets Lost:</span> <span class="font-bold text-rose-400">${oneBitRes.packetsLost}</span></div>
              <div class="flex justify-between"><span>Total Time:</span> <span class="text-slate-200">${oneBitRes.totalSimulationTime.toFixed(0)} ms</span></div>
              <div class="flex justify-between"><span>Throughput:</span> <span class="font-bold text-emerald-400">${oneBitRes.throughput} fps</span></div>
              <div class="flex justify-between"><span>Efficiency:</span> <span class="font-bold text-indigo-400">${oneBitRes.efficiency}%</span></div>
            </div>
          </div>
        </div>

        <!-- GBN -->
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-sm text-indigo-400">Go-Back-N</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">Window: ${winSize}</span>
            </div>
            <div class="space-y-1 text-xs text-slate-300 font-mono mt-3">
              <div class="flex justify-between"><span>Retransmissions:</span> <span class="font-bold text-amber-400">${gbnRes.retransmissions}</span></div>
              <div class="flex justify-between"><span>Packets Lost:</span> <span class="font-bold text-rose-400">${gbnRes.packetsLost}</span></div>
              <div class="flex justify-between"><span>Total Time:</span> <span class="text-slate-200">${gbnRes.totalSimulationTime.toFixed(0)} ms</span></div>
              <div class="flex justify-between"><span>Throughput:</span> <span class="font-bold text-emerald-400">${gbnRes.throughput} fps</span></div>
              <div class="flex justify-between"><span>Efficiency:</span> <span class="font-bold text-indigo-400">${gbnRes.efficiency}%</span></div>
            </div>
          </div>
        </div>

        <!-- SR -->
        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-sm text-emerald-400">Selective Repeat</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">Window: ${winSize}</span>
            </div>
            <div class="space-y-1 text-xs text-slate-300 font-mono mt-3">
              <div class="flex justify-between"><span>Retransmissions:</span> <span class="font-bold text-amber-400">${srRes.retransmissions}</span></div>
              <div class="flex justify-between"><span>Packets Lost:</span> <span class="font-bold text-rose-400">${srRes.packetsLost}</span></div>
              <div class="flex justify-between"><span>Total Time:</span> <span class="text-slate-200">${srRes.totalSimulationTime.toFixed(0)} ms</span></div>
              <div class="flex justify-between"><span>Throughput:</span> <span class="font-bold text-emerald-400">${srRes.throughput} fps</span></div>
              <div class="flex justify-between"><span>Efficiency:</span> <span class="font-bold text-indigo-400">${srRes.efficiency}%</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Textual Summary Format directly matching the PDF assignment -->
      <div class="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/40 font-mono text-xs leading-relaxed space-y-2 text-slate-300">
        <div class="font-bold text-indigo-400 text-sm tracking-wide">PROTOCOL COMPARISON REPORT:</div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-y-1.5 pt-1">
          <div><span class="text-slate-400">One-Bit SW Retransmissions:</span> <span class="font-bold text-amber-300">${oneBitRes.retransmissions}</span></div>
          <div><span class="text-slate-400">Go-Back-N Retransmissions:</span> <span class="font-bold text-amber-300">${gbnRes.retransmissions}</span></div>
          <div><span class="text-slate-400">Selective Repeat Retransmissions:</span> <span class="font-bold text-amber-300">${srRes.retransmissions}</span></div>
          <div><span class="text-slate-400">One-Bit SW Efficiency:</span> <span class="font-bold text-emerald-300">${oneBitRes.efficiency}%</span></div>
          <div><span class="text-slate-400">Go-Back-N Efficiency:</span> <span class="font-bold text-emerald-300">${gbnRes.efficiency}%</span></div>
          <div><span class="text-slate-400">Selective Repeat Efficiency:</span> <span class="font-bold text-emerald-300">${srRes.efficiency}%</span></div>
        </div>
      </div>
    `;

    // Render Chart.js Chart
    renderChart([oneBitRes, gbnRes, srRes]);
  }

  function renderChart(results) {
    const canvas = document.getElementById('comparisonChartCanvas');
    if (!canvas) return;

    if (comparisonChart) {
      comparisonChart.destroy();
    }

    const labels = results.map(r => r.name);
    const retransmissions = results.map(r => r.retransmissions);
    const efficiency = results.map(r => r.efficiency);
    const throughput = results.map(r => r.throughput);

    comparisonChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Retransmissions (lower is better)',
            data: retransmissions,
            backgroundColor: 'rgba(245, 158, 11, 0.75)',
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            yAxisID: 'y'
          },
          {
            label: 'Efficiency % (higher is better)',
            data: efficiency,
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            yAxisID: 'y1'
          },
          {
            label: 'Throughput (fps)',
            data: throughput,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#cbd5e1',
              font: { family: 'JetBrains Mono', size: 11 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono', weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } },
            grid: { color: 'rgba(51, 65, 85, 0.4)' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Retransmissions', color: '#f59e0b' },
            ticks: { color: '#f59e0b', font: { family: 'JetBrains Mono' } },
            grid: { color: 'rgba(51, 65, 85, 0.4)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Efficiency (%)', color: '#818cf8' },
            ticks: { color: '#818cf8', font: { family: 'JetBrains Mono' } },
            grid: { drawOnChartArea: false }
          },
          y2: {
            type: 'linear',
            display: false,
            position: 'right',
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // Initial startup
  initSimulation();
});
