/**
 * Sliding Window Protocol Simulation Engine
 * Supports:
 *  1. One-Bit Sliding Window (Stop-and-Wait)
 *  2. Go-Back-N (GBN)
 *  3. Selective Repeat (SR)
 */

class ProtocolEngine {
  constructor(config = {}) {
    this.setConfig(config);
    this.reset();
  }

  setConfig(config) {
    this.protocol = config.protocol || 'gbn'; // 'one-bit', 'gbn', 'sr'
    this.totalFrames = Math.max(1, parseInt(config.totalFrames || 10, 10));
    this.windowSize = this.protocol === 'one-bit' ? 1 : Math.max(1, parseInt(config.windowSize || 4, 10));
    this.transmissionDelay = Math.max(10, parseInt(config.transmissionDelay || 150, 10)); // ms
    this.ackDelay = Math.max(10, parseInt(config.ackDelay || 100, 10)); // ms
    this.packetLossRate = Math.max(0, Math.min(100, parseFloat(config.packetLossRate || 10))) / 100;
    this.ackLossRate = Math.max(0, Math.min(100, parseFloat(config.ackLossRate || 5))) / 100;
    this.timeout = Math.max(50, parseInt(config.timeout || 400, 10)); // ms
  }

  reset() {
    this.currentTime = 0; // Simulated time in ms
    this.isCompleted = false;

    // Sender state
    this.sendBase = 0;
    this.nextSeqNum = 0;
    // Each frame tracking
    this.senderFrames = Array.from({ length: this.totalFrames }, (_, i) => ({
      seq: i,
      status: 'idle', // 'idle', 'in_flight', 'acked', 'timeout', 'lost'
      sentTimes: 0,
      firstSentTime: null,
      lastSentTime: null,
      ackedTime: null,
      timerExpiryTime: null
    }));

    // For GBN: single timer for sendBase
    this.gbnTimerExpiry = null;

    // Receiver state
    this.rcvBase = 0;
    this.expectedSeqNum = 0; // For GBN and Stop-and-Wait
    this.receivedFrames = Array.from({ length: this.totalFrames }, (_, i) => ({
      seq: i,
      received: false,
      buffered: false,
      receivedTime: null
    }));

    // In-flight packets and ACKs
    this.channelPackets = []; // { id, seq, sendTime, arriveTime, isLost, droppedManually, type: 'DATA' }
    this.channelAcks = [];    // { id, ackSeq, sendTime, arriveTime, isLost, droppedManually, type: 'ACK' }
    this.packetIdCounter = 1;

    // Statistics
    this.stats = {
      totalTransmitted: 0,
      originalTransmitted: 0,
      retransmissions: 0,
      packetsLost: 0,
      acksLost: 0,
      acksReceived: 0,
      framesDelivered: 0,
      totalSimulationTime: 0,
      throughput: 0, // frames / sec
      efficiency: 0  // percentage
    };

    // Event Log for timeline & ladder diagram
    this.events = [];
    this.ladderEvents = []; // For spacetime diagram
    this.addLog('SYSTEM', `Simulation initialized for ${this.getProtocolName()} with ${this.totalFrames} frames, Window Size: ${this.windowSize}`);
  }

  getProtocolName() {
    if (this.protocol === 'one-bit') return 'One-Bit Sliding Window';
    if (this.protocol === 'gbn') return 'Go-Back-N';
    if (this.protocol === 'sr') return 'Selective Repeat';
    return this.protocol;
  }

  addLog(source, message, type = 'info') {
    const entry = {
      time: this.currentTime,
      source,
      message,
      type
    };
    this.events.push(entry);
    return entry;
  }

  // Check if sender can transmit more frames
  canSend() {
    if (this.protocol === 'one-bit') {
      return this.sendBase < this.totalFrames && this.nextSeqNum === this.sendBase && this.senderFrames[this.sendBase].status !== 'in_flight';
    } else if (this.protocol === 'gbn' || this.protocol === 'sr') {
      return this.nextSeqNum < this.totalFrames && this.nextSeqNum < this.sendBase + this.windowSize;
    }
    return false;
  }

  // Trigger send for the next frame
  sendNextFrame() {
    if (!this.canSend()) return null;

    const seq = this.nextSeqNum;
    this.transmitFrame(seq, false);
    this.nextSeqNum++;
    return seq;
  }

  transmitFrame(seq, isRetransmit = false) {
    const frame = this.senderFrames[seq];
    frame.status = 'in_flight';
    frame.sentTimes++;
    if (frame.firstSentTime === null) frame.firstSentTime = this.currentTime;
    frame.lastSentTime = this.currentTime;

    this.stats.totalTransmitted++;
    if (isRetransmit) {
      this.stats.retransmissions++;
    } else {
      this.stats.originalTransmitted++;
    }

    // Determine loss based on packetLossRate
    const willLose = Math.random() < this.packetLossRate;
    if (willLose) {
      this.stats.packetsLost++;
    }

    const arriveTime = this.currentTime + this.transmissionDelay;
    const packet = {
      id: this.packetIdCounter++,
      seq,
      sendTime: this.currentTime,
      arriveTime,
      isLost: willLose,
      droppedManually: false,
      isRetransmit,
      type: 'DATA',
      progress: 0
    };
    this.channelPackets.push(packet);

    // Setup timers
    if (this.protocol === 'one-bit') {
      frame.timerExpiryTime = this.currentTime + this.timeout;
    } else if (this.protocol === 'gbn') {
      // In GBN, timer is started if it is not already running
      if (this.gbnTimerExpiry === null) {
        this.gbnTimerExpiry = this.currentTime + this.timeout;
      }
    } else if (this.protocol === 'sr') {
      // In SR, individual timer per frame
      frame.timerExpiryTime = this.currentTime + this.timeout;
    }

    const retransmitLabel = isRetransmit ? ' (Retransmission)' : '';
    this.addLog('SENDER', `Sent Frame ${seq}${retransmitLabel}`, isRetransmit ? 'warning' : 'send');

    this.ladderEvents.push({
      type: 'FRAME_SENT',
      packetId: packet.id,
      seq,
      isRetransmit,
      isLost: willLose,
      sendTime: this.currentTime,
      arriveTime,
      lossPoint: willLose ? 0.65 : null
    });

    return packet;
  }

  // Force-drop a packet by ID (interactive user drop)
  dropPacket(id) {
    const pkt = this.channelPackets.find(p => p.id === id);
    if (pkt && !pkt.isLost && !pkt.droppedManually) {
      pkt.isLost = true;
      pkt.droppedManually = true;
      this.stats.packetsLost++;
      this.addLog('CHANNEL', `Frame ${pkt.seq} was manually dropped in channel!`, 'danger');
      const ladderEv = this.ladderEvents.find(e => e.packetId === id);
      if (ladderEv) {
        ladderEv.isLost = true;
        ladderEv.droppedManually = true;
        ladderEv.lossPoint = Math.min(0.9, Math.max(0.2, (this.currentTime - pkt.sendTime) / this.transmissionDelay));
      }
      return true;
    }
    return false;
  }

  // Force-drop an ACK by ID
  dropAck(id) {
    const ack = this.channelAcks.find(a => a.id === id);
    if (ack && !ack.isLost && !ack.droppedManually) {
      ack.isLost = true;
      ack.droppedManually = true;
      this.stats.acksLost++;
      this.addLog('CHANNEL', `ACK ${ack.ackSeq} was manually dropped in channel!`, 'danger');
      const ladderEv = this.ladderEvents.find(e => e.packetId === id);
      if (ladderEv) {
        ladderEv.isLost = true;
        ladderEv.droppedManually = true;
        ladderEv.lossPoint = Math.min(0.9, Math.max(0.2, (this.currentTime - ack.sendTime) / this.ackDelay));
      }
      return true;
    }
    return false;
  }

  // Advance simulation by dt milliseconds
  step(dt = 10) {
    if (this.isCompleted) return;

    this.currentTime += dt;

    // 1. Process Channel Packets (Sender -> Receiver)
    const remainingPackets = [];
    for (const pkt of this.channelPackets) {
      pkt.progress = Math.min(1, (this.currentTime - pkt.sendTime) / this.transmissionDelay);

      if (this.currentTime >= pkt.arriveTime) {
        if (pkt.isLost) {
          this.addLog('RECEIVER', `Frame ${pkt.seq} was LOST in channel`, 'danger');
        } else {
          this.handlePacketArrival(pkt);
        }
      } else {
        remainingPackets.push(pkt);
      }
    }
    this.channelPackets = remainingPackets;

    // 2. Process Channel ACKs (Receiver -> Sender)
    const remainingAcks = [];
    for (const ack of this.channelAcks) {
      ack.progress = Math.min(1, (this.currentTime - ack.sendTime) / this.ackDelay);

      if (this.currentTime >= ack.arriveTime) {
        if (ack.isLost) {
          this.addLog('SENDER', `ACK ${ack.ackSeq} was LOST in channel`, 'danger');
        } else {
          this.handleAckArrival(ack);
        }
      } else {
        remainingAcks.push(ack);
      }
    }
    this.channelAcks = remainingAcks;

    // 3. Process Timeouts
    this.checkTimeouts();

    // 4. Fill window if possible
    while (this.canSend()) {
      this.sendNextFrame();
    }

    // 5. Check completion
    this.checkCompletion();
    this.updateStats();
  }

  handlePacketArrival(pkt) {
    const seq = pkt.seq;

    if (this.protocol === 'one-bit') {
      if (seq === this.expectedSeqNum) {
        this.receivedFrames[seq].received = true;
        this.receivedFrames[seq].receivedTime = this.currentTime;
        this.stats.framesDelivered++;
        this.expectedSeqNum++;
        this.addLog('RECEIVER', `Frame ${seq} received in order. Sending ACK ${seq}`, 'success');
        this.sendAck(seq);
      } else {
        // Duplicate frame received (previous ACK probably lost)
        this.addLog('RECEIVER', `Duplicate Frame ${seq} received (expected ${this.expectedSeqNum}). Resending ACK ${seq}`, 'warning');
        this.sendAck(seq);
      }
    } else if (this.protocol === 'gbn') {
      if (seq === this.expectedSeqNum) {
        this.receivedFrames[seq].received = true;
        this.receivedFrames[seq].receivedTime = this.currentTime;
        this.stats.framesDelivered++;
        this.addLog('RECEIVER', `Frame ${seq} received in order. Sending cumulative ACK ${seq}`, 'success');
        this.sendAck(seq);
        this.expectedSeqNum++;
      } else {
        // Out of order frame discarded in GBN
        const lastAck = this.expectedSeqNum - 1;
        this.addLog('RECEIVER', `Frame ${seq} received OUT OF ORDER (expected ${this.expectedSeqNum}). Frame discarded.`, 'danger');
        if (lastAck >= 0) {
          this.addLog('RECEIVER', `Resending ACK ${lastAck} for last in-order frame`, 'warning');
          this.sendAck(lastAck, true);
        }
      }
    } else if (this.protocol === 'sr') {
      // Selective Repeat: accepts any frame within receiver window [rcvBase, rcvBase + windowSize - 1]
      const minWin = this.rcvBase;
      const maxWin = this.rcvBase + this.windowSize - 1;

      if (seq >= minWin && seq <= maxWin) {
        this.receivedFrames[seq].received = true;
        this.receivedFrames[seq].receivedTime = this.currentTime;

        if (seq === this.rcvBase) {
          this.stats.framesDelivered++;
          this.addLog('RECEIVER', `Frame ${seq} received in order. Sending ACK ${seq}`, 'success');
          // Slide receiver window forward
          this.rcvBase++;
          while (this.rcvBase < this.totalFrames && this.receivedFrames[this.rcvBase].received) {
            this.stats.framesDelivered++;
            this.rcvBase++;
          }
        } else {
          // Buffered out of order
          this.receivedFrames[seq].buffered = true;
          this.addLog('RECEIVER', `Frame ${seq} received OUT OF ORDER and BUFFERED. Sending selective ACK ${seq}`, 'warning');
        }
        this.sendAck(seq);
      } else if (seq < minWin) {
        // Already acknowledged earlier, resend ACK
        this.addLog('RECEIVER', `Frame ${seq} already acknowledged (prior to window). Resending ACK ${seq}`, 'info');
        this.sendAck(seq);
      } else {
        this.addLog('RECEIVER', `Frame ${seq} outside receiver window [${minWin}, ${maxWin}]. Ignored.`, 'danger');
      }
    }
  }

  sendAck(ackSeq, isDuplicate = false) {
    const willLose = Math.random() < this.ackLossRate;
    if (willLose) {
      this.stats.acksLost++;
    }

    const arriveTime = this.currentTime + this.ackDelay;
    const ack = {
      id: this.packetIdCounter++,
      ackSeq,
      isDuplicate,
      sendTime: this.currentTime,
      arriveTime,
      isLost: willLose,
      droppedManually: false,
      type: 'ACK',
      progress: 0
    };
    this.channelAcks.push(ack);

    this.ladderEvents.push({
      type: 'ACK_SENT',
      packetId: ack.id,
      seq: ackSeq,
      isDuplicate,
      isLost: willLose,
      sendTime: this.currentTime,
      arriveTime,
      lossPoint: willLose ? 0.65 : null
    });
  }

  handleAckArrival(ack) {
    this.stats.acksReceived++;
    const ackSeq = ack.ackSeq;

    if (this.protocol === 'one-bit') {
      if (ackSeq === this.sendBase) {
        this.senderFrames[this.sendBase].status = 'acked';
        this.senderFrames[this.sendBase].ackedTime = this.currentTime;
        this.addLog('SENDER', `Received ACK ${ackSeq}. Window advanced.`, 'success');
        this.sendBase++;
      }
    } else if (this.protocol === 'gbn') {
      // Cumulative ACK in GBN: all frames up to ackSeq are acknowledged
      if (ackSeq >= this.sendBase && ackSeq < this.nextSeqNum) {
        const oldBase = this.sendBase;
        for (let i = oldBase; i <= ackSeq; i++) {
          this.senderFrames[i].status = 'acked';
          if (!this.senderFrames[i].ackedTime) this.senderFrames[i].ackedTime = this.currentTime;
        }
        this.sendBase = ackSeq + 1;
        this.addLog('SENDER', `Received cumulative ACK ${ackSeq}. Window base advanced to ${this.sendBase}`, 'success');

        // Restart timer if still unacked frames exist
        if (this.sendBase < this.nextSeqNum) {
          this.gbnTimerExpiry = this.currentTime + this.timeout;
        } else {
          this.gbnTimerExpiry = null;
        }
      } else {
        this.addLog('SENDER', `Received duplicate / stale ACK ${ackSeq} (current base: ${this.sendBase})`, 'info');
      }
    } else if (this.protocol === 'sr') {
      // Individual ACK in SR
      if (ackSeq >= 0 && ackSeq < this.totalFrames) {
        this.senderFrames[ackSeq].status = 'acked';
        this.senderFrames[ackSeq].ackedTime = this.currentTime;
        this.senderFrames[ackSeq].timerExpiryTime = null;
        this.addLog('SENDER', `Received ACK ${ackSeq} for specific frame`, 'success');

        // If base is acked, advance window base
        while (this.sendBase < this.totalFrames && this.senderFrames[this.sendBase].status === 'acked') {
          this.sendBase++;
        }
      }
    }
  }

  checkTimeouts() {
    if (this.protocol === 'one-bit') {
      const frame = this.senderFrames[this.sendBase];
      if (frame && frame.status === 'in_flight' && frame.timerExpiryTime && this.currentTime >= frame.timerExpiryTime) {
        this.addLog('SENDER', `TIMEOUT for Frame ${this.sendBase}! Retransmitting Frame ${this.sendBase}`, 'timeout');
        this.ladderEvents.push({
          type: 'TIMEOUT',
          seq: this.sendBase,
          time: this.currentTime,
          note: `Timeout Frame ${this.sendBase}`
        });
        this.transmitFrame(this.sendBase, true);
      }
    } else if (this.protocol === 'gbn') {
      if (this.gbnTimerExpiry !== null && this.currentTime >= this.gbnTimerExpiry) {
        this.addLog('SENDER', `TIMEOUT in GBN for base Frame ${this.sendBase}! Retransmitting window: ${this.sendBase} to ${this.nextSeqNum - 1}`, 'timeout');
        this.ladderEvents.push({
          type: 'TIMEOUT',
          seq: this.sendBase,
          time: this.currentTime,
          note: `GBN Timeout! Retransmit ${this.sendBase}..${this.nextSeqNum - 1}`
        });

        // Restart GBN timer
        this.gbnTimerExpiry = this.currentTime + this.timeout;

        // Retransmit all unacknowledged frames in current window
        for (let i = this.sendBase; i < this.nextSeqNum; i++) {
          this.transmitFrame(i, true);
        }
      }
    } else if (this.protocol === 'sr') {
      // In SR, check timeouts individually for each unacked frame in window
      for (let i = this.sendBase; i < Math.min(this.totalFrames, this.sendBase + this.windowSize); i++) {
        const frame = this.senderFrames[i];
        if (frame.status === 'in_flight' && frame.timerExpiryTime && this.currentTime >= frame.timerExpiryTime) {
          this.addLog('SENDER', `TIMEOUT for Frame ${i}! Retransmitting ONLY Frame ${i}`, 'timeout');
          this.ladderEvents.push({
            type: 'TIMEOUT',
            seq: i,
            time: this.currentTime,
            note: `SR Timeout! Retransmit ${i}`
          });
          // Retransmit ONLY frame i
          this.transmitFrame(i, true);
        }
      }
    }
  }

  checkCompletion() {
    if (this.sendBase >= this.totalFrames) {
      if (!this.isCompleted) {
        this.isCompleted = true;
        this.stats.totalSimulationTime = this.currentTime;
        this.addLog('SYSTEM', `Simulation completed successfully! All ${this.totalFrames} frames acknowledged.`, 'complete');
      }
    }
  }

  updateStats() {
    this.stats.totalSimulationTime = this.currentTime;
    // Throughput: Delivered Frames / second
    const seconds = Math.max(0.001, this.currentTime / 1000);
    this.stats.throughput = parseFloat(((this.stats.framesDelivered / seconds)).toFixed(2));
    // Efficiency: (Delivered Frames / Total Transmitted Frames) * 100
    if (this.stats.totalTransmitted > 0) {
      this.stats.efficiency = parseFloat(((this.stats.framesDelivered / this.stats.totalTransmitted) * 100).toFixed(1));
    } else {
      this.stats.efficiency = 0;
    }
  }

  // Fast-forward run entire simulation synchronously to completion (useful for multi-protocol comparison)
  runToCompletion(maxTicks = 100000, dt = 10) {
    let ticks = 0;
    while (!this.isCompleted && ticks < maxTicks) {
      this.step(dt);
      ticks++;
    }
    return {
      protocol: this.protocol,
      name: this.getProtocolName(),
      windowSize: this.windowSize,
      totalTransmitted: this.stats.totalTransmitted,
      retransmissions: this.stats.retransmissions,
      packetsLost: this.stats.packetsLost,
      acksReceived: this.stats.acksReceived,
      totalSimulationTime: this.stats.totalSimulationTime,
      throughput: this.stats.throughput,
      efficiency: this.stats.efficiency
    };
  }
}

// Export for browser and node
if (typeof window !== 'undefined') {
  window.ProtocolEngine = ProtocolEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProtocolEngine;
}
