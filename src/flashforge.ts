import * as dgram from 'dgram'
import { EventEmitter } from 'events'
import * as net from 'net'

import { Command, EndstopStatus, parseCommand, PrinterInformation, StatusInformation, TemperatureInformation } from './parser'
import { commands } from './printers/adventurer3'

interface PrinterOptions {
  host: string
  port?: number
}

export declare interface Printer {
  on (event: 'connected' | 'disconnected', listener: () => void): this
  on (event: 'information', listener: (information: PrinterInformation['result']) => void): this
  on (event: 'endstop', listener: (endstop: EndstopStatus['result']) => void): this
  on (event: 'temperature', listener: (information: TemperatureInformation['result']) => void): this
  on (event: 'status', listener: (status: StatusInformation['result']) => void): this
  once (event: 'connected' | 'disconnected', listener: () => void): this
  once (event: 'information', listener: (information: PrinterInformation['result']) => void): this
  once (event: 'endstop', listener: (endstop: EndstopStatus['result']) => void): this
  once (event: 'temperature', listener: (information: TemperatureInformation['result']) => void): this
  once (event: 'status', listener: (status: StatusInformation['result']) => void): this
}

export class Printer extends EventEmitter {
  public information: PrinterInformation['result'] | null
  public host: string
  public port: number
  private socket: net.Socket | null

  constructor (options: PrinterOptions) {
    super()
    this.information = null
    this.host = options.host
    this.port = options.port || 8899
    this.socket = null
  }

  public connect (): void {
    this.socket = new net.Socket()
    this.socket.on('data', (buffer) => this.parse(buffer))
    this.socket.connect({
      host: this.host,
      port: this.port
    }, () => {
      this.send(commands.connect)
    })
  }

  public send (cmd: string): void {
    if (!this.socket) throw new Error('Tried to write command without connecting first')
    this.socket.write(cmd)
  }

  private parse (buffer: Buffer): void {
    const parsed = parseCommand(buffer)
    if (!parsed) return console.log('unknown command:', { buffer, s: buffer.toString() })

    if (parsed.command === Command.Control) {
      this.emit('connected')
    }

    if (parsed.command === Command.ControlRelease) {
      this.emit('disconnected')
    }

    if (parsed.command === Command.PrinterInformation) {
      this.information = parsed.result
      this.emit('information', parsed.result)
    }

    if (parsed.command === Command.EndstopStatus) {
      this.emit('endstop', parsed.result)
    }

    if (parsed.command === Command.Temperature) {
      this.emit('temperature', parsed.result)
    }

    if (parsed.command === Command.Status) {
      this.emit('status', parsed.result)
    }
  }
}

const multicastAddress = '225.0.0.9'
const multicastPort = 19000
const searchMessage = Buffer.from([ 0xC0, 0xA8, 0x01, 0x43, 0x46, 0x50, 0x00, 0x00 ])
const searchPort = 18000

export function findPrinters (): Promise<Printer[]> {
  return new Promise((resolve) => {
    const printers: Printer[] = []

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    socket.on('listening', () => {
      socket.addMembership(multicastAddress)
    })

    socket.on('message', (msg, info) => {
      printers.push(new Printer({
        host: info.address
      }))
    })

    socket.bind(searchPort)

    socket.send(searchMessage, 0, searchMessage.length, multicastPort, multicastAddress)

    setTimeout(() => {
      resolve(printers)
    }, 2000)
  })
}
