declare module 'afipjs' {
  interface AfipOptions {
    CUIT: number
    cert: string
    key: string
    production?: boolean
  }

  interface VoucherData {
    CAE: string
    CAEFchVto: string
    [key: string]: any
  }

  interface ElectronicBilling {
    getLastVoucher(ptoVenta: number, tipo: number): Promise<number>
    createNextVoucher(data: Record<string, any>): Promise<VoucherData>
  }

  class Afip {
    constructor(options: AfipOptions)
    ElectronicBilling: ElectronicBilling
  }

  export default Afip
}
