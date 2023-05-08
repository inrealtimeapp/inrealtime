const encodeEmoji = (emoji: string) => {
  return emoji?.codePointAt(0)?.toString(16) ?? ''
}

const decodeEmoji = (hex: any) => {
  if (hex === undefined) {
    return ''
  }

  return String.fromCodePoint(parseInt(`${hex}`, 16))
}

export const formatEmoji = (emoji: string) => {
  return decodeEmoji(encodeEmoji(emoji))
}
