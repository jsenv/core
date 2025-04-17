const opponentSpritesheetUrl = new URL(
  "./opponent_sprite.png",
  import.meta.url,
);
const hpAbove = (limit) => {
  return ({ hp, hpMax }) => {
    const hpLimit =
      typeof limit === "string" ? (parseFloat(limit) / 100) * hpMax : limit;
    return hp > hpLimit;
  };
};

export const taurus = {
  name: "Taurus",
  attributes: {
    hp: 55,
    attack: 1,
    defense: 0,
    speed: 2,
  },
  abilities: {
    horns: {
      name: "Cornes",
      power: 10,
    },
  },
  image: {
    url: opponentSpritesheetUrl,
    transparentColor: [0, 202, 202],
    width: 62,
    height: 62,
  },
  states: {
    full_life: {
      conditions: {
        hp: hpAbove("80%"),
      },
      image: {
        x: 450,
        y: 100,
      },
    },
    mid_life: {
      conditions: {
        hp: hpAbove("25%"),
      },
      image: {
        x: 515,
        y: 100,
      },
      abilities: {
        horns: null,
        bite: {
          name: "Morsure",
          power: 2,
        },
      },
    },
    low_life: {
      conditions: {
        hp: () => true,
      },
      image: {
        x: 580,
        y: 100,
      },
      abilities: {
        horns: null,
        bite: null,
        charge: {
          name: "Charge",
          power: 5,
        },
      },
    },
  },
};
