import { Input } from '@/components/ui/input';
import type { LivePlayerIdentity, LivePlayerInfo } from '@/lib/liveMode';

interface Props {
    infos: { left: LivePlayerInfo; right: LivePlayerInfo };
    onChange: (
        side: 'left' | 'right',
        patch: Partial<LivePlayerIdentity>
    ) => void;
}

const FIELDS: { key: keyof LivePlayerIdentity; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'deckName', label: 'Deck' },
    { key: 'standing', label: 'Standing' },
    { key: 'pronouns', label: 'Pronouns' },
];

function PlayerFields({
    side,
    info,
    onChange,
}: {
    side: 'left' | 'right';
    info: LivePlayerInfo;
    onChange: Props['onChange'];
}) {
    return (
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {FIELDS.map(({ key, label }) => {
                const id = `player-${side}-${key}`;
                return (
                    <div key={key} className="flex items-center gap-3">
                        <label
                            htmlFor={id}
                            className="w-20 shrink-0 text-sm font-medium"
                        >
                            {label}
                        </label>
                        <Input
                            id={id}
                            className="h-8"
                            value={info[key]}
                            onChange={(e) =>
                                onChange(side, { [key]: e.target.value })
                            }
                        />
                    </div>
                );
            })}
        </div>
    );
}

function PlayersSection({ infos, onChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-1">Players</h2>
                <p className="text-xs text-muted-foreground">
                    Identity shown on the scoreboard. Standing and Pronouns are
                    exposed to the scoreboard SVG as the{' '}
                    <code>standing</code> and <code>pronouns</code> fields.
                </p>
            </div>

            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Left Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <PlayerFields side="left" info={infos.left} onChange={onChange} />
            </div>

            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Right Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <PlayerFields
                    side="right"
                    info={infos.right}
                    onChange={onChange}
                />
            </div>
        </div>
    );
}

export default PlayersSection;
