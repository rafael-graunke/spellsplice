import type { FunctionComponent, ComponentProps } from 'react';

type SvgIcon = FunctionComponent<ComponentProps<'svg'> & { title?: string }>;

import _Draw from './draw.svg';
import _Discard from './discard.svg';
import _Heal from './heal.svg';
import _Damage from './damage.svg';
import _Reveal from './reveal.svg';
import _Shuffle from './shuffle.svg';
import _StackTop from './stack_top.svg';
import _EventBackground from './event_bg.svg';
import _Eye from './eye.svg';
import _Book from './book.svg';

export const EventBackground = _EventBackground as unknown as SvgIcon;
export const Draw = _Draw as unknown as SvgIcon;
export const Discard = _Discard as unknown as SvgIcon;
export const Damage = _Damage as unknown as SvgIcon;
export const Heal = _Heal as unknown as SvgIcon;
export const Reveal = _Reveal as unknown as SvgIcon;
export const Shuffle = _Shuffle as unknown as SvgIcon;
export const StackTop = _StackTop as unknown as SvgIcon;
export const Eye = _Eye as unknown as SvgIcon;
export const Book = _Book as unknown as SvgIcon;
