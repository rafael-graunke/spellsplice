interface Event {
  time: number;
  duration?: number;
}

export interface DrawEvent extends Event {}
