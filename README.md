# ISS Dashboard

Live ISS telemetry: the water tanks, cabin air, the solar arrays and a reboost alert.

![The urine tank: yellow liquid at 38% sloshing, with bubbles rising](media/urine.gif)

The International Space Station sends its telemetry to the ground, and NASA publishes part of it. The front display shows a piece of it at a time: the station's three water tanks, the air in the cabin, the solar arrays turning. Turn the wheel to change what you look at; the back display lists all the numbers at once. When the station fires its engines to raise its orbit, an alert takes over the display, and then the liquids in the tanks lie against a wall until the burn is over.

A JavaScript app for [BUSY Bar](https://busy.app).

## What the bar shows

The app starts on the three tanks of Node 3 side by side: the urine, the waste water and the clean water, each with its level in percent and a bar filled to it.

![URINE 36%, WASTE 49%, CLEAN 84%](media/tanks.png)

The wheel then shows each tank on the whole display, filled to its level, with its name and level over it. The urine is yellow, with bubbles rising through it. It lies under a flat surface that tilts when the liquid is kicked and swings back and forth like a pendulum, a swing in about 3 seconds, settling in about 10, with a small ripple rising and falling on it; however far it tilts, the liquid keeps its volume. What kicks it is the Slosh setting: jolts at random, or the station's gyroscopes.

When an update finds more urine in the tank than the last one did while the urine tank is on the display, someone aboard has just used the toilet: for four seconds a thin stream pours in from the top with a trickling sound, the level rises from the old value to the new one, and the liquid sloshes.

![A stream pouring into the urine tank, the level rising from 38% to 45%](media/stream.gif)

The waste water is a garbage heap.

![The waste water tank: a garbage heap at 49%](media/waste.png)

The clean water is blue and sloshes the same way.

![The clean water tank at 84%](media/clean.gif)

Cabin air in the US Lab: the temperature, the pressure and the CO2 partial pressure.

![23.4°C, 757 mmHg, CO2 2.4 mmHg](media/cabin-air.png)

The solar arrays, seen from above the station as it flies up the display: the truss across, the modules along the middle, and the eight wings. Each wing gets shorter as its Solar Alpha Rotary Joint turns it away from the viewer and narrower as its Beta Gimbal turns it about its length, by the real joint angles. On the right is the beta angle, how far the Sun is out of the plane of the orbit.

![The solar arrays and the beta angle](media/arrays.png)

Between two updates the arrays keep turning at the rate they turned between the last two, when those were less than 20 minutes apart, and the view is redrawn every second. A rotary joint makes a turn in about an hour and a half, one orbit, so the wings change slowly; this GIF shows a little over four minutes in five seconds.

![The wings getting shorter as the joints turn, sped up](media/arrays.gif)

When an update first finds the station's mode is Reboost, an alert with the station and its engine firing replaces any view for 10 seconds, with a sound and the status light blinking orange.

![REBOOST](media/reboost.png)

Then the views come back. While the engines push the station, the urine and the clean water gather at the left wall of the display as a column, overshooting and sloshing on the way; when an update finds the reboost over, they flow back and slosh until they settle.

![After the alert the urine runs to the left wall and stands there as a column; when the reboost is over it flows back](media/reboost-tank.gif)

The back display lists every number: the three tanks, the states of the urine and the water processor, temperature, pressure, O2, N2, CO2, the beta angle, the station mode, and the age of the data, counted up from when the station sent it.

![The back display with all the numbers](media/back.png)

![The back display during a reboost: MODE REBOOST](media/reboost-back.png)

While the station is out of touch with the ground, the telemetry stands still. When an update brings telemetry sent more than a minute before it, the values are dimmed, the arrays stop, and the back display labels the age NO SIGNAL.

![The tanks dimmed while the station has no signal](media/no-signal.png)

![The back display with NO SIGNAL and the age of the data](media/no-signal-back.png)

The last good update is kept on the bar and shown dimmed at the start until the first answer. When an update fails, the last values stay, dimmed, with a red cross in a corner of the front display, and the back display labels the age NO LINK.

![Without a connection: the tanks dimmed with a red cross](media/offline.png)

![The back display with NO LINK](media/offline-back.png)

Without a connection and with nothing kept, every value is `--`, on the back display too.

![Without a connection and nothing kept: -- in every tank](media/offline-empty.png)

## Buttons

| Button | What it does |
| --- | --- |
| Wheel | Switches the view: the three tanks, the urine, the waste water, the clean water, cabin air, the solar arrays. |
| Back | Leaves the app. |

## Settings

| Setting | What it does |
| --- | --- |
| Slosh | What sets the urine and the clean water sloshing. Random: jolts at random moments, every few seconds. Gyroscopes: the station's control moment gyroscopes, the spinning wheels that hold its attitude; each change of their control torque, about once a second, kicks the liquid as hard as the torque changed. Random by default. |

With Gyroscopes, the liquids lie still while the station is out of touch with the ground: the torque does not change then. The app reads its settings when it starts.

## Data

NASA's public ISS telemetry (ISSLIVE) from Lightstreamer's demo server, read over Lightstreamer HTTP requests every five minutes. The last good update is kept on the bar. With the Slosh setting on Gyroscopes, while the urine or the clean water is on the display, the app also keeps one Lightstreamer session open for the gyroscopes' control torque and asks it for new values as soon as each answer comes, about once a second; after a failed request it starts again 10 seconds later.

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
