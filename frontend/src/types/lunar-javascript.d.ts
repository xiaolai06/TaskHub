declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
  }

  export class Lunar {
    getDayInChinese(): string
    getMonthInChinese(): string
    getYearInChinese(): string
  }
}
