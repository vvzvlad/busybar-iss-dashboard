# ISS Dashboard

Live telemetry from the International Space Station on your desk.

A JavaScript app for [BUSY Bar](https://busy.app). Work in progress.

## What it does

- Plumbing: the urine, waste water and clean water tanks side by side, with the state of the water processors.
- Cabin air: temperature, pressure and CO2 aboard the station.
- Solar arrays: a live animation of the arrays turning, from the real joint angles, and the current beta angle.
- Reboost alert: when the station switches into reboost mode, an alert pops up over any view with a sound and the status light.
- The wheel switches between the views. While the station has no signal, the values freeze.

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
