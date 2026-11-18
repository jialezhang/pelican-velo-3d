# Le Grand Prix du Pélican — Côte d'Azur 3D Interactive Experience

Real-time WebGL2 3D interactive showcase featuring **Capitaine Archibald**, an articulated white pelican riding a celeste-mint vintage steel touring bicycle along a sunlit Mediterranean lighthouse causeway.

## Highlights
- **Analytical 2-Bone Inverse Kinematics (`pelican-ik.js`)**: Exact 3D IK solving both legs (`hip -> knee -> ankle -> webbed foot`) onto rotating horizontal bicycle pedals, dual-mode feathered wings (handlebar grip IK <-> 2.5m flight wingspan), 5-bone spring-damped S-neck, and elastic subsurface gular pouch physics.
- **Mechanical Lugged Bicycle & 48-Link Roller Chain (`bicycle-rig.js`)**: 24-spoke tangent-laced gumwall wheels, 5-arm star crankset, animated roller chain loop, steerable front fork, rotary brass bell, chrome dynamo headlamp, and woven front basket with baguette & sardines.
- **Custom GLSL Ocean & Sky Shaders + Procedural Web Audio (`world-shaders-audio.js`)**: Multi-wave Gerstner ocean shader with shallow reef scattering, shoreline sea-foam, night bioluminescent plankton, rotating volumetric lighthouse beams, and zero-dependency Web Audio synthesizer (freehub ratchet clicks, ocean surf, brass bell FM chimes, pelican reed honk).
