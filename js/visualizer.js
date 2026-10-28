/**
 * Visualizer Module:
 * - High-DPI (Retina/4K) Crisp Canvas Spacetime Sequence Diagram
 * - Clear Physical Network Channel with distinct Data & ACK flight paths
 * - Sender & Receiver sliding window status tracking
 */

class Visualizer {
  constructor(engine, elements = {}) {
    this.engine = engine;
    this.channelContainer = elements.channelContainer;
    this.senderWindowEl = elements.senderWindowEl;
    this.receiverWindowEl = elements.receiverWindowEl;
    this.ladderCanvas = elements.ladderCanvas;
    this.ladderCtx = this.ladderCanvas ? this.ladderCanvas.getContext('2d') : null;
    this.ladderScrollContainer = elements.ladderScrollContainer;

    // Spacing scale: ms to pixels (0.4 gives generous vertical breathing room)
    this.ladderPixelsPerMs = 0.42;
  }

  setEngine(engine) {
    this.engine = engine;
  }

  render() {
    this.renderChannel();
    this.renderSenderWindow();
    this.renderReceiverWindow();
    this.renderLadderDiagram();
  }

  // 1. Channel Animation Rendering
  renderChannel() {
    if (!this.channelContainer) return;

    const existingPacketEls = new Map();
    this.channelContainer.querySelectorAll('.packet-node').forEach(el => {
      existingPacketEls.set(el.dataset.id, el);
    });

    const activePacketIds = new Set();

    // Data packets (Sender -> Receiver: Left to Right)
    this.engine.channelPackets.forEach(pkt => {
      const idStr = `pkt-${pkt.id}`;
      activePacketIds.add(idStr);

      let el = existingPacketEls.get(idStr);
      if (!el) {
        el = document.createElement('div');
        el.className = 'packet-node absolute z-30 transition-transform duration-75 select-none cursor-pointer';
        el.dataset.id = idStr;
        el.title = `Click to drop Frame ${pkt.seq} manually!`;
        
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.dropPacket(pkt.id);
          this.render();
        });

        this.channelContainer.appendChild(el);
      }

      const percent = Math.min(100, Math.max(0, pkt.progress * 100));
      const isLostNow = pkt.isLost && pkt.progress >= (pkt.droppedManually ? 0.2 : 0.65);

      if (isLostNow) {
        el.className = 'packet-node absolute z-30 flex items-center justify-center select-none bg-rose-600 text-white font-mono text-xs px-3 py-1.5 rounded-lg shadow-xl border-2 border-rose-300 ring-4 ring-rose-500/40 animate-bounce';
        el.innerHTML = `
          <span class="font-extrabold flex items-center gap-1.5 text-xs tracking-wide">
            <svg class="w-4 h-4 text-rose-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
            FRAME ${pkt.seq} LOST
          </span>
        `;
      } else {
        const bg = pkt.isRetransmit ? 'bg-amber-600 border-amber-300 ring-amber-500/30' : 'bg-sky-600 border-sky-300 ring-sky-500/30';
        el.className = `packet-node absolute z-30 flex items-center justify-center cursor-pointer select-none ${bg} text-white font-mono text-xs px-3 py-1.5 rounded-lg shadow-xl border-2 ring-4 hover:scale-125 hover:bg-rose-600 hover:ring-rose-400 transition-all active:scale-95`;
        el.innerHTML = `
          <div class="flex items-center gap-1.5 font-bold tracking-wide">
            <span class="bg-black/20 px-1.5 py-0.5 rounded text-[11px]">${pkt.isRetransmit ? 'RE-TX' : 'DATA'}</span>
            <span class="text-sm">F${pkt.seq}</span>
            <svg class="w-3.5 h-3.5 text-white/90 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </div>
        `;
      }

      // Upper track: Data frames
      const leftPos = 8 + (percent * 0.84);
      el.style.left = `${leftPos}%`;
      el.style.top = '30%';
      el.style.transform = 'translate(-50%, -50%)';
    });

    // ACK packets (Receiver -> Sender: Right to Left)
    this.engine.channelAcks.forEach(ack => {
      const idStr = `ack-${ack.id}`;
      activePacketIds.add(idStr);

      let el = existingPacketEls.get(idStr);
      if (!el) {
        el = document.createElement('div');
        el.className = 'packet-node absolute z-30 transition-transform duration-75 select-none cursor-pointer';
        el.dataset.id = idStr;
        el.title = `Click to drop ACK ${ack.ackSeq} manually!`;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.dropAck(ack.id);
          this.render();
        });

        this.channelContainer.appendChild(el);
      }

      const percent = Math.min(100, Math.max(0, ack.progress * 100));
      const isLostNow = ack.isLost && ack.progress >= (ack.droppedManually ? 0.2 : 0.65);

      if (isLostNow) {
        el.className = 'packet-node absolute z-30 flex items-center justify-center select-none bg-rose-600 text-white font-mono text-xs px-3 py-1.5 rounded-lg shadow-xl border-2 border-rose-300 ring-4 ring-rose-500/40 animate-bounce';
        el.innerHTML = `
          <span class="font-extrabold flex items-center gap-1.5 text-xs tracking-wide">
            <svg class="w-4 h-4 text-rose-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
            ACK ${ack.ackSeq} LOST
          </span>
        `;
      } else {
        el.className = 'packet-node absolute z-30 flex items-center justify-center cursor-pointer select-none bg-emerald-600 text-white font-mono text-xs px-3 py-1.5 rounded-lg shadow-xl border-2 border-emerald-300 ring-4 ring-emerald-500/30 hover:scale-125 hover:bg-rose-600 hover:ring-rose-400 transition-all active:scale-95';
        el.innerHTML = `
          <div class="flex items-center gap-1.5 font-bold tracking-wide">
            <svg class="w-3.5 h-3.5 text-white/90 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            <span class="bg-black/20 px-1.5 py-0.5 rounded text-[11px]">${ack.isDuplicate ? 'DUP' : 'ACK'}</span>
            <span class="text-sm">ACK ${ack.ackSeq}</span>
          </div>
        `;
      }

      // Lower track: ACKs (Reverse direction: 92% to 8%)
      const leftPos = 92 - (percent * 0.84);
      el.style.left = `${leftPos}%`;
      el.style.top = '70%';
      el.style.transform = 'translate(-50%, -50%)';
    });

    // Clean up expired elements
    existingPacketEls.forEach((el, key) => {
      if (!activePacketIds.has(key)) {
        el.remove();
      }
    });
  }

  // 2. Sender Window Visualizer
  renderSenderWindow() {
    if (!this.senderWindowEl) return;

    let html = '';
    const winSize = this.engine.windowSize;
    const base = this.engine.sendBase;
    const winLimit = base + winSize;

    for (let i = 0; i < this.engine.totalFrames; i++) {
      const f = this.engine.senderFrames[i];
      let statusStyle = '';
      let badge = '';

      const inWindow = i >= base && i < winLimit;

      if (f.status === 'acked') {
        statusStyle = 'bg-emerald-500/25 text-emerald-200 border-emerald-500/80 shadow-md';
        badge = 'ACKed';
      } else if (f.status === 'in_flight') {
        statusStyle = 'bg-sky-500/30 text-sky-200 border-sky-400 ring-2 ring-sky-400 shadow-lg animate-pulse';
        badge = f.sentTimes > 1 ? `Re-${f.sentTimes}` : 'In-Flight';
      } else if (inWindow) {
        statusStyle = 'bg-indigo-500/20 text-indigo-200 border-indigo-400/80 border-dashed';
        badge = 'In Win';
      } else {
        statusStyle = 'bg-slate-900/60 text-slate-500 border-slate-800';
        badge = 'Queued';
      }

      const isBase = i === base && base < this.engine.totalFrames;
      const windowHighlight = inWindow ? 'ring-2 ring-indigo-400' : '';

      html += `
        <div class="relative flex flex-col items-center justify-between p-2 rounded-xl border font-mono transition-all min-w-[62px] ${statusStyle} ${windowHighlight}">
          <span class="text-[10px] opacity-75 font-semibold">Frame</span>
          <span class="text-base font-black my-0.5">${i}</span>
          <span class="text-[9px] uppercase font-bold tracking-wider px-1 rounded bg-black/30">${badge}</span>
          ${isBase ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-lg border border-indigo-300">BASE</span>' : ''}
        </div>
      `;
    }

    this.senderWindowEl.innerHTML = html;
  }

  // 3. Receiver Window Visualizer
  renderReceiverWindow() {
    if (!this.receiverWindowEl) return;

    let html = '';
    const isSR = this.engine.protocol === 'sr';
    const rcvBase = isSR ? this.engine.rcvBase : this.engine.expectedSeqNum;
    const rcvWinSize = isSR ? this.engine.windowSize : 1;

    for (let i = 0; i < this.engine.totalFrames; i++) {
      const rf = this.engine.receivedFrames[i];
      let statusStyle = '';
      let badge = '';

      const inWindow = i >= rcvBase && i < rcvBase + rcvWinSize;

      if (rf.received && !rf.buffered) {
        statusStyle = 'bg-emerald-500/25 text-emerald-200 border-emerald-500/80 shadow-md';
        badge = 'Delivered';
      } else if (rf.buffered) {
        statusStyle = 'bg-purple-500/30 text-purple-200 border-purple-400 ring-2 ring-purple-400 shadow-lg';
        badge = 'Buffered';
      } else if (inWindow) {
        statusStyle = 'bg-amber-500/20 text-amber-200 border-amber-400/80 border-dashed';
        badge = 'Expected';
      } else {
        statusStyle = 'bg-slate-900/60 text-slate-500 border-slate-800';
        badge = 'Waiting';
      }

      const isRcvBase = i === rcvBase && rcvBase < this.engine.totalFrames;
      const windowHighlight = inWindow ? 'ring-2 ring-amber-400' : '';

      html += `
        <div class="relative flex flex-col items-center justify-between p-2 rounded-xl border font-mono transition-all min-w-[62px] ${statusStyle} ${windowHighlight}">
          <span class="text-[10px] opacity-75 font-semibold">Frame</span>
          <span class="text-base font-black my-0.5">${i}</span>
          <span class="text-[9px] uppercase font-bold tracking-wider px-1 rounded bg-black/30">${badge}</span>
          ${isRcvBase ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-full shadow-lg border border-amber-300">RCV_BASE</span>' : ''}
        </div>
      `;
    }

    this.receiverWindowEl.innerHTML = html;
  }

  // 4. Space-Time Sequence Diagram (HiDPI Razor-Sharp Rendering)
  renderLadderDiagram() {
    if (!this.ladderCanvas || !this.ladderCtx) return;

    const ctx = this.ladderCtx;
    const container = this.ladderScrollContainer;

    // HiDPI Scaling Factor (Prevents blur on modern 1080p, 1440p, 4K and Windows 125%/150% scaling)
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const totalSimTime = Math.max(1200, this.engine.currentTime + 350);
    const logicalHeight = Math.max(520, totalSimTime * this.ladderPixelsPerMs + 100);
    const logicalWidth = container ? container.clientWidth : 540;

    // Only update canvas dimensions when changed to avoid layout thrashing
    const physicalWidth = Math.floor(logicalWidth * dpr);
    const physicalHeight = Math.floor(logicalHeight * dpr);

    if (this.ladderCanvas.width !== physicalWidth || this.ladderCanvas.height !== physicalHeight) {
      this.ladderCanvas.width = physicalWidth;
      this.ladderCanvas.height = physicalHeight;
      this.ladderCanvas.style.width = `${logicalWidth}px`;
      this.ladderCanvas.style.height = `${logicalHeight}px`;
    }

    // Reset and scale context for crisp vector rendering
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const xSender = 110;
    const xReceiver = logicalWidth - 110;
    const topMargin = 55;

    // Background horizontal grid lines every 200ms
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let t = 0; t <= totalSimTime; t += 200) {
      const y = topMargin + t * this.ladderPixelsPerMs;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(logicalWidth - 30, y);
      ctx.stroke();

      // Timestamp labels (Left & Right)
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t}ms`, xSender - 16, y + 4);
    }
    ctx.setLineDash([]);
    ctx.textAlign = 'left';

    // Vertical Sender Line (with glowing pulse gradient)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(xSender, topMargin - 15);
    ctx.lineTo(xSender, logicalHeight - 20);
    ctx.stroke();

    // Vertical Receiver Line
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(xReceiver, topMargin - 15);
    ctx.lineTo(xReceiver, logicalHeight - 20);
    ctx.stroke();

    // Top Station Headers
    this.drawNodeBadge(ctx, xSender, topMargin - 28, 'SENDER', '#0284c7');
    this.drawNodeBadge(ctx, xReceiver, topMargin - 28, 'RECEIVER', '#059669');

    // Draw all transmission events with crisp vector lines and readable pill badges
    this.engine.ladderEvents.forEach(ev => {
      const yStart = topMargin + ev.sendTime * this.ladderPixelsPerMs;

      if (ev.type === 'FRAME_SENT') {
        const yEnd = topMargin + ev.arriveTime * this.ladderPixelsPerMs;
        const isLost = ev.isLost;

        if (isLost) {
          // Packet lost in channel
          const lossRatio = ev.lossPoint || 0.65;
          const xBreak = xSender + (xReceiver - xSender) * lossRatio;
          const yBreak = yStart + (yEnd - yStart) * lossRatio;

          // Red line to drop point
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(xSender, yStart);
          ctx.lineTo(xBreak, yBreak);
          ctx.stroke();

          // Prominent "X" mark & label
          this.drawLostX(ctx, xBreak, yBreak, `Frame ${ev.seq} (LOST)`);
        } else {
          // Normal or Retransmitted Arrow
          ctx.strokeStyle = ev.isRetransmit ? '#f59e0b' : '#38bdf8';
          ctx.lineWidth = 2.5;
          this.drawArrow(ctx, xSender, yStart, xReceiver, yEnd);

          // Clear crisp badge along the arrow
          const midX = xSender + (xReceiver - xSender) * 0.35;
          const midY = yStart + (yEnd - yStart) * 0.35;
          const label = `Frame ${ev.seq}${ev.isRetransmit ? ' (Re-Tx)' : ''}`;
          this.drawCrispLabel(ctx, midX, midY, label, ev.isRetransmit ? '#fbbf24' : '#7dd3fc', '#0b1329');
        }
      } else if (ev.type === 'ACK_SENT') {
        const yEnd = topMargin + ev.arriveTime * this.ladderPixelsPerMs;
        const isLost = ev.isLost;

        if (isLost) {
          const lossRatio = ev.lossPoint || 0.65;
          const xBreak = xReceiver - (xReceiver - xSender) * lossRatio;
          const yBreak = yStart + (yEnd - yStart) * lossRatio;

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(xReceiver, yStart);
          ctx.lineTo(xBreak, yBreak);
          ctx.stroke();

          this.drawLostX(ctx, xBreak, yBreak, `ACK ${ev.seq} (LOST)`);
        } else {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.5;
          this.drawArrow(ctx, xReceiver, yStart, xSender, yEnd);

          // Clear crisp badge along the ACK arrow
          const midX = xReceiver - (xReceiver - xSender) * 0.35;
          const midY = yStart + (yEnd - yStart) * 0.35;
          const label = `ACK ${ev.seq}${ev.isDuplicate ? ' (Dup)' : ''}`;
          this.drawCrispLabel(ctx, midX, midY, label, '#6ee7b7', '#06231c');
        }
      } else if (ev.type === 'TIMEOUT') {
        const yTime = topMargin + ev.time * this.ladderPixelsPerMs;

        // Timeout warning indicator
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(xSender, yTime, 5, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing bracket/tag
        ctx.fillStyle = '#fecaca';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        this.drawCrispLabel(ctx, xSender + 60, yTime, `TIMEOUT: ${ev.note}`, '#f87171', '#2d0606');
      }
    });

    ctx.restore();

    // Auto-scroll ladder smoothly as simulation advances
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  drawNodeBadge(ctx, x, y, text, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x - 52, y - 12, 104, 26, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLen = 12;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Sharp Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  drawCrispLabel(ctx, x, y, text, textColor, bgColor) {
    ctx.save();
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    const textMetrics = ctx.measureText(text);
    const padX = 8;
    const padY = 4;
    const w = textMetrics.width + padX * 2;
    const h = 20;

    // Pill background
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  drawLostX(ctx, x, y, label) {
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();

    this.drawCrispLabel(ctx, x + 55, y, label, '#fca5a5', '#380505');
    ctx.restore();
  }
}

// Export for browser and node
if (typeof window !== 'undefined') {
  window.Visualizer = Visualizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Visualizer;
}
