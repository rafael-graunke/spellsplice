import { CheckIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover';

type Channel = 'production' | 'beta' | 'dev';

// The three deploy channels, ordered stable -> bleeding edge. `url` is null for
// dev because it only ever runs on the developer's own machine, so there is
// nowhere to send someone. Badge colours are semantic (traffic light), not
// brand: green = safe, amber = caution, blue = neutral/local. The bar tint in
// index.tsx uses the same hues so a channel reads consistently.
const CHANNELS: {
    id: Channel;
    label: string;
    url: string | null;
    blurb: string;
    badge: string;
}[] = [
    {
        id: 'production',
        label: 'Stable',
        url: 'https://app.spellsplice.com',
        blurb: 'Fully tested. Can lag behind the newest features.',
        badge: 'bg-green-500/15 text-green-700 dark:text-green-400',
    },
    {
        id: 'beta',
        label: 'Beta',
        url: 'https://beta.spellsplice.com',
        blurb: 'Newest features first. May be unstable.',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    },
    {
        id: 'dev',
        label: 'Dev',
        url: null,
        blurb: 'Local build. Runs only on your machine.',
        badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    },
];

function ChannelRow({ channel, isCurrent }: { channel: (typeof CHANNELS)[number]; isCurrent: boolean }) {
    return (
        <div className="flex items-start gap-2 p-2">
            <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${channel.badge}`}
            >
                {channel.label.toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1 text-sm font-medium">
                    {channel.label}
                    {isCurrent && <CheckIcon className="size-3.5 text-muted-foreground" />}
                    {!isCurrent && channel.url && (
                        <ExternalLinkIcon className="size-3 text-muted-foreground" />
                    )}
                </span>
                <span className="text-xs text-muted-foreground">{channel.blurb}</span>
            </div>
        </div>
    );
}

function ChannelMenu() {
    const current = __APP_CHANNEL__;
    const active = CHANNELS.find((c) => c.id === current) ?? CHANNELS[0];

    return (
        <Popover>
            <PopoverTrigger className="ml-auto flex h-full items-center gap-1.5 px-3 outline-hidden transition-colors select-none hover:bg-foreground/5">
                <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${active.badge}`}
                >
                    {active.label.toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
                <ChevronDownIcon className="size-3 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
                <PopoverHeader>
                    <PopoverTitle>Channels</PopoverTitle>
                    <p className="text-xs text-muted-foreground">
                        Open Spellsplice on a different release channel.
                    </p>
                </PopoverHeader>
                <div className="flex flex-col">
                    {CHANNELS.map((c) => {
                        const isCurrent = c.id === current;
                        if (isCurrent) {
                            return (
                                <div key={c.id} className="rounded-md bg-foreground/5">
                                    <ChannelRow channel={c} isCurrent />
                                </div>
                            );
                        }
                        if (!c.url) {
                            return (
                                <div key={c.id} className="opacity-50">
                                    <ChannelRow channel={c} isCurrent={false} />
                                </div>
                            );
                        }
                        return (
                            <a
                                key={c.id}
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md hover:bg-foreground/5"
                            >
                                <ChannelRow channel={c} isCurrent={false} />
                            </a>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ChannelMenu;
