import { Image, MessageSquare, Mic } from 'lucide-react';

export const modes = [
  { id: 'voice' as const, label: 'Voice', description: 'Speak & listen', icon: Mic, number: '01' },
  {
    id: 'chat' as const,
    label: 'Chat',
    description: 'Ask & explore',
    icon: MessageSquare,
    number: '02',
  },
  {
    id: 'images' as const,
    label: 'Image',
    description: 'Generate images',
    icon: Image,
    number: '03',
  },
];
