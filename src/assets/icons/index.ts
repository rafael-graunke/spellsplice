import type { FunctionComponent, ComponentProps } from 'react';

type SvgIcon = FunctionComponent<ComponentProps<'svg'> & { title?: string }>;

import _Draw from './draw.svg';
import _Discard from './discard.svg';
import _Heal from './heal.svg';
import _Damage from './damage.svg';
import _Reveal from './reveal.svg';
import _UnstackDeck from './unstack_deck.svg';
import _StackDeck from './stack_deck.svg';
import _EventBackground from './event_bg.svg';
import _Eye from './eye.svg';
import _Book from './book.svg';
import _Win from './win.svg';
import _PlayHead from './playhead.svg';

export const EventBackground = _EventBackground as unknown as SvgIcon;
export const Draw = _Draw as unknown as SvgIcon;
export const Discard = _Discard as unknown as SvgIcon;
export const Damage = _Damage as unknown as SvgIcon;
export const Heal = _Heal as unknown as SvgIcon;
export const Reveal = _Reveal as unknown as SvgIcon;
export const UnstackDeck = _UnstackDeck as unknown as SvgIcon;
export const StackDeck = _StackDeck as unknown as SvgIcon;
export const Eye = _Eye as unknown as SvgIcon;
export const Book = _Book as unknown as SvgIcon;
export const Win = _Win as unknown as SvgIcon;
export const PlayHead = _PlayHead as unknown as SvgIcon;
