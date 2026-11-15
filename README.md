# ISS Dashboard

Live telemetry from the International Space Station on your desk.

A JavaScript app for [BUSY Bar](https://busy.app). Work in progress.

## What it does

- Plumbing: the urine, waste water and clean water tanks side by side, then each tank on the whole display: sloshing yellow urine with rising bubbles, a garbage heap of waste, sloshing blue clean water.
- Cabin air: temperature, pressure and CO2 aboard the station.
- Solar arrays: the station seen from above, its eight wings turning by the real joint angles, and the current beta angle.
- Reboost alert: when the station switches into reboost mode, an alert pops up over any view with a sound and the status light.
- The wheel switches between the views. The back display lists all the numbers: the tanks, the urine and water processors, temperature, pressure, O2, N2, CO2, the beta angle, the station mode and the age of the data.
- While the station has no signal, the values dim and the back display says NO SIGNAL. Without a connection the last values stay, dimmed, with a red cross in the corner.

## Data

NASA's public ISS telemetry (ISSLIVE), read over Lightstreamer HTTP requests every five minutes.

## Build

Node 24 and npm:

```sh
npm ci
npm run build         # dist/io.github.vvzvlad.iss.tgz
npm run app:install   # install it on a BUSY Bar connected over USB
npm run app:run       # start it
```

## License

[MIT](LICENSE)
