import { Command, flags } from '@oclif/command'

import { findPrinters } from '../flashforge'

export default class IPs extends Command {
  public static description = 'Get IPs of local printers'

  public static flags = {
    help: flags.help({ char: 'h' })
  }

  public async run (): Promise<void> {
    const printers = await findPrinters()

    if (printers.length === 0) {
      this.error('Could not find any printers on the local network.')
    }

    console.log(`Found ${printers.length} printer${printers.length === 1 ? '' : 's'}`)

    printers.forEach((printer) => {
      console.log(`- ${printer.host}:${printer.port}`)
    })

    process.exit()
  }
}
