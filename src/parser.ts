export interface CommandParseResult<T, R = {}> {
  command: T,
  result: R
}

export enum Command {
  M601 = 'M601',
  Control = 'M601',
  M602 = 'M602',
  ControlRelease = 'M602',
  M115 = 'M115',
  PrinterInformation = 'M115',
  M119 = 'M119',
  EndstopStatus = 'M119'
}

interface XYZ {
  x: number,
  y: number,
  z: number
}

const defaultXYZ: XYZ = {
  x: -1,
  y: -1,
  z: -1
}

export interface ControlStatus extends CommandParseResult<Command.Control> {}
export interface ControlRelease extends CommandParseResult<Command.ControlRelease> {}

export interface PrinterInformation extends CommandParseResult<Command.PrinterInformation, {
  type: string,
  name: string,
  version: string,
  serial: string,
  buildVolume: XYZ,
  toolCount: number,
  macAddress: string
}> {}

export interface EndstopStatus extends CommandParseResult<Command.EndstopStatus, {
  endstop: XYZ,
  machineStatus: string,
  moveMode: string,
  status: {
    s: number,
    l: number,
    j: number,
    f: number
  }
}> {}

export type ParseResult = ControlStatus | ControlRelease | PrinterInformation | EndstopStatus

export function parseCommand (buffer: Buffer): ParseResult | null {
  const lines = buffer.toString().split('\r\n')
  const firstLine = lines.shift()
  if (!firstLine) return null

  const cmdMatch = firstLine.match(/CMD (.+) Received./)
  if (!cmdMatch) return null

  const cmd = cmdMatch[1]

  switch (cmd) {
    case Command.M115: return parsePrinterInformation(lines)
    case Command.M119: return parseEndstopStatus(lines)
    case Command.M601: return { command: Command.M601, result: {} }
    case Command.M602: return { command: Command.M602, result: {} }
  }

  return null
}

function getPair<T> (pairs: Array<string[] | null>, searchName: string, defaultValue: T, fn?: (value: string) => T): T {
  const match = pairs.find((pair) => pair && pair[0] === searchName)
  if (!match) return defaultValue
  if (fn) return fn(match[1])
  return match[1] as unknown as T
}

function parseColonDelimited<T> (value: string, defaultValue: T, keys: string[], numbers?: boolean): T {
  const regex = new RegExp(keys.map((key) => `${key}:([^\s]+)`).join('\\s'))

  const match = value.match(regex)
  if (!match) return defaultValue

  const out: {[key: string]: any} = {}

  match.shift()

  for (let i = 0; i < keys.length; i++) {
    let v: string | number = match[i].trim()

    if (numbers) v = parseInt(v)

    out[keys[i]] = v
  }

  return out as unknown as T
}

interface ParseLinesOptions {
  data: string[],
  overrides?: Array<{
    match: string,
    output: string
  }>
}

function parseLines ({ data, overrides }: ParseLinesOptions): Array<string[] | null> {
  const pairs = data.map((line) => {
    if (line.split(':').length - 1 === 0) return null

    // If our line includes an override, just return the entire line.
    if (overrides) {
      const matched = overrides.find((override) => line.includes(override.match))
      if (matched) return [ matched.output, line ]
    }

    return line.split(':')
  })
  .filter(Boolean)
  .map((pair) => {
    if (!pair) return null
    if (pair[1].substr(0, 1) === ' ') pair[1] = pair[1].substr(1)
    return pair
  })

  return pairs
}

function parsePrinterInformation (data: string[]): PrinterInformation | null {
  const pairs = parseLines({
    data,
    overrides: [
      { match: 'X:', output: 'buildVolume' },
      { match: 'Mac Address:', output: 'macAddress' }
    ]
  })

  const parseVolume = (value: string) => parseColonDelimited<XYZ>(value, defaultXYZ, [
    'X', 'Y', 'Z'
  ], true)

  const name = getPair<string>(pairs, 'Machine Name', 'Unknown name')
  const type = getPair<string>(pairs, 'Machine Type', 'Unknown type')
  const version = getPair<string>(pairs, 'Firmware', 'Unknown firmware')
  const serial = getPair<string>(pairs, 'SN', 'Unknown serial')
  const buildVolume = getPair<XYZ>(pairs, 'buildVolume', { x: -1, y: -1, z: -1 }, parseVolume)
  const toolCount = getPair<number>(pairs, 'Tool Count', -1, (value) => parseInt(value))
  const macAddress = getPair<string>(pairs, 'macAddress', 'Unknown MAC Address', (value) => value.replace('Mac Address: ', '').replace(/\n/g, ''))

  return {
    command: Command.PrinterInformation,
    result: {
      name,
      type,
      version,
      serial,
      buildVolume,
      toolCount,
      macAddress
    }
  }
}

function parseEndstopStatus (data: string[]): EndstopStatus | null {
  const pairs = parseLines({
    data,
    overrides: [
      { match: 'Endstop:', output: 'endstop' },
      { match: 'Status: S', output: 'status' }
    ]
  })

  const defaultStatus: EndstopStatus['result']['status'] = {
    s: -1,
    l: -1,
    j: -1,
    f: -1
  }

  const parseEndstop = (value: string) => parseColonDelimited<XYZ>(value, defaultXYZ, [ 'X-max', 'Y-max', 'Z-max' ], true)
  const parseStatus = (value: string) => parseColonDelimited(value, defaultStatus, [ 'S', 'L', 'J', 'F' ], true)

  const machineStatus = getPair<string>(pairs, 'MachineStatus', 'Unknown status')
  const moveMode = getPair<string>(pairs, 'MoveMode', 'Unknown move mode')
  const endstop = getPair<XYZ>(pairs, 'endstop', defaultXYZ, parseEndstop)
  const status = getPair(pairs, 'status', defaultStatus, parseStatus)

  return {
    command: Command.EndstopStatus,
    result: {
      machineStatus,
      moveMode,
      endstop,
      status
    }
  }
}
