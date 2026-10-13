import type { Participant, Photo } from '../types'

export function photoTime(photo: Pick<Photo, 'capturedAt'>): string {
  if (photo.capturedAt === undefined || !Number.isFinite(photo.capturedAt)) return '拍摄时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(photo.capturedAt))
}

export function photographerName(
  photo: Pick<Photo, 'photographerId'>,
  participants: Participant[],
): string {
  return participants.find((person) => person.id === photo.photographerId)?.name ?? '未知拍摄者'
}

export function filenameCaption(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || '旅途中的一刻'
  )
}
