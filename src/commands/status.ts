import { Command, flags } from '@oclif/command'
import * as chalk from 'chalk'
import { Bar, Presets } from 'cli-progress'
import * as notifier from 'node-notifier'

import { findPrinters } from '../flashforge'
import { commands } from '../printers/adventurer3'

export default class Status extends Command {
  public static description = 'Get status of local printer'

  public static flags = {
    help: flags.help({ char: 'h' }),
    watch: flags.boolean({ char: 'w' })
  }

  public async run () {
    const { args, flags: opts } = this.parse(Status)

    const printers = await findPrinters()

    if (printers.length === 0) {
      this.error('Could not find any printers on the local network.')
    }

    const printer = printers[0]

    printer.once('connected', () => {
      printer.once('information', (info) => {
        printer.once('endstop', (endstop) => {
          printer.once('status', (status) => {
            console.log(chalk.bold(`- ${info.name} (${info.type})`))

            if (endstop.machineStatus !== 'BUILDING_FROM_SD') {
              console.log('Status: Not building')
              printer.send(commands.disconnect)
              process.exit(0)
            }

            const bar = new Bar({
              format: `Printing [{bar}] {percentage}%`
            }, Presets.shades_classic)

            bar.start(100, status.percentage)

            const exit = () => {
              bar.stop()
              printer.send(commands.disconnect)
              process.exit(0)
            }

            if (!opts.watch) {
              exit()
            }

            printer.on('status', (update) => {
              bar.update(update.percentage)

              if (update.percentage === 100) {
                notifier.notify({
                  title: `FlashForge`,
                  message: `${info.name} has finished printing`
                })
                exit()
              }
            })

            process.once('SIGINT', exit)

            setInterval(() => {
              printer.send(commands.status)
            }, 1000)
          })
          printer.send(commands.status)
        })
        printer.send(commands.endstopStatus)
      })
      printer.send(commands.info)
    })

    printer.connect()
  }
}
