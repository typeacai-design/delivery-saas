// Geração de BR Code PIX dinâmico (padrão EMV)
// Documentação: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II-ManualdePadroesparaIniciacaodoPix.pdf

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16(payload: string): string {
  // Polinômio 0x1021, valor inicial 0xFFFF
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF
      } else {
        crc = (crc << 1) & 0xFFFF
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface PixPayloadInput {
  chave: string
  nomeRecebedor: string
  cidade: string
  valor: number
  txid: string
}

export function gerarBrCodePix({ chave, nomeRecebedor, cidade, valor, txid }: PixPayloadInput): string {
  // Merchant Account Information (ID 26)
  const gui = tlv('00', 'br.gov.bcb.pix')
  const pixKey = tlv('01', chave)
  const merchantAccount = tlv('26', gui + pixKey)

  // Valor da transação (ID 54) - obrigatório se tiver
  const valorStr = valor.toFixed(2)
  const transactionAmount = tlv('54', valorStr)

  // TxID (ID 05) dentro de Additional Data Field
  const additionalData = tlv('05', txid.slice(0, 25))

  // Monta payload SEM CRC
  const payload =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '11') + // Point of Initiation Method (11 = dinâmico)
    merchantAccount +
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Transaction Currency (986 = BRL)
    transactionAmount +
    tlv('58', 'BR') + // Country Code
    tlv('59', nomeRecebedor.slice(0, 25)) + // Merchant Name
    tlv('60', cidade.slice(0, 15)) + // Merchant City
    tlv('62', additionalData) // Additional Data Field Template

  // Adiciona CRC16
  const withCrc = payload + '6304' + crc16(payload)
  return withCrc
}
