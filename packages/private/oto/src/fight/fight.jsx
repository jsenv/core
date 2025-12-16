import { computed, signal } from "@preact/signals";
import { useKeyEffect } from "hooks/use_key_effect.js";
import { music } from "oto/src/audio/music/music.js";
import { sound } from "oto/src/audio/sound/sound.js";
import { Box, borderWithStroke } from "oto/src/components/box/box_oto.jsx";
import { Curtain } from "oto/src/components/curtain/curtain.jsx";
import { DialogTextBox } from "oto/src/components/dialog_text_box/dialog_text_box.jsx";
import { Lifebar } from "oto/src/components/lifebar/lifebar.jsx";
import { useGamePaused } from "oto/src/game_pause/game_pause.js";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Ally } from "./ally.jsx";
import { MountainAndSkyBattleBackground } from "./battle_background/battle_backgrounds.jsx";
import { MenuFight } from "./menu_fight.jsx";
import { Opponent } from "./opponent.jsx";
import { SwordAImg } from "./sword_a.jsx";
import { taurus } from "./taurus.js";

// const fightStartSoundUrl = import.meta.resolve("../fight/fight_start.ogg");
const battleMusicUrl = import.meta.resolve("../fight/battle_bg_a.mp3");
const heroHitSoundUrl = import.meta.resolve("../fight/hero_hit_2.mp3");
const oponentDieSoundUrl = import.meta.resolve("../fight/opponent_die.mp3");
const victoryMusicUrl = import.meta.resolve("../fight/victory.mp3");
export const swordASoundUrl = import.meta.resolve("./sword_a.mp3");

const opponentSignal = signal(taurus);
const opponentImageSignal = computed(() => opponentSignal.value.image);
const opponentNameSignal = computed(() => opponentSignal.value.name);
const opponentHpMaxSignal = computed(() => opponentSignal.value.attributes.hp);
const opponentAttackSignal = computed(
  () => opponentSignal.value.attributes.attack,
);
const opponentDefenseSignal = computed(
  () => opponentSignal.value.attributes.defense,
);
const opponentSpeedSignal = computed(
  () => opponentSignal.value.attributes.speed,
);
const opponentStatesSignal = computed(() => opponentSignal.value.states);
const opponentAbilitiesSignal = computed(() => opponentSignal.value.abilities);

const heroSpeedSignal = signal(1);
const heroAttackSignal = signal(1);
const heroDefenseSignal = signal(1);
const weaponPowerSignal = signal(200);

const swordSound = sound({
  url: swordASoundUrl,
  volume: 0.5,
  startTime: 0.1,
});
// const fightStartSound = createSound({
//   url: fightStartSoundUrl,
//   volume: 0.7,
// });
const heroHitSound = sound({
  url: heroHitSoundUrl,
  volume: 0.7,
});
const opponentDieSound = sound({
  url: oponentDieSoundUrl,
  volume: 0.7,
});
const battleMusic = music({
  name: "battle",
  url: battleMusicUrl,
});
const victoryMusic = music({
  name: "victory",
  url: victoryMusicUrl,
  volume: 0.5,
});

export const Fight = ({ onFightEnd }) => {
  const dialogRef = useRef();
  const gamePaused = useGamePaused();

  const [fightStep, fightStepSetter] = useState("waiting");
  const fightIsWaiting = fightStep === "waiting";
  const playerIsSelectingTarget = fightStep === "player_is_selecting_target";
  const fightIsWon = fightStep === "won";
  const fightIsLost = fightStep === "lost";
  const fightIsOver = fightIsWon || fightIsLost;

  const opponentName = opponentNameSignal.value;
  const opponentAttack = opponentAttackSignal.value;
  const opponentDefense = opponentDefenseSignal.value;
  const opponentSpeed = opponentSpeedSignal.value;
  const opponentHpMax = opponentHpMaxSignal.value;
  const [opponentHp, opponentHpSetter] = useState(opponentHpMax);
  const decreaseOpponentHp = useCallback((value) => {
    opponentHpSetter((hp) => hp - value);
  }, []);
  const [opponentIsDead, opponentIsDeadSetter] = useState(false);
  const opponentAbilitiesBase = opponentAbilitiesSignal.value;
  const opponentStates = opponentStatesSignal.value;
  const opponentStateKey = opponentStates
    ? Object.keys(opponentStates).find((key) => {
        const { conditions } = opponentStates[key];
        if (
          conditions.hp &&
          conditions.hp({ hp: opponentHp, hpMax: opponentHpMax })
        ) {
          return true;
        }
        return false;
      })
    : null;
  const opponentPropsFromState = opponentStateKey
    ? opponentStates[opponentStateKey]
    : {};
  const opponentAbilities = Object.assign(
    opponentAbilitiesBase,
    opponentPropsFromState.abilities,
  );
  let opponentImage = opponentImageSignal.value;
  if (opponentPropsFromState.image) {
    opponentImage = {
      ...opponentImage,
      ...opponentPropsFromState.image,
    };
  }
  const oponentRef = useRef();

  const [opponentImageDisplayed, opponentImageDisplayedSetter] =
    useState(false);
  const onOpponentFirstDisplay = useCallback(() => {
    opponentImageDisplayedSetter(true);
  }, []);

  const heroRef = useRef();
  const heroAttack = heroAttackSignal.value;
  const heroDefense = heroDefenseSignal.value;
  const heroSpeed = heroSpeedSignal.value;
  const weaponPower = weaponPowerSignal.value;

  const [heroHp, heroHpSetter] = useState(40);
  const decreaseHeroHp = useCallback((value) => {
    heroHpSetter((hp) => hp - value);
  }, []);
  const [heroMaxHp] = useState(40);

  useEffect(() => {
    battleMusic.play();
    // fightStartSound.play();
  }, []);
  const backgroundCurtainRef = useRef();

  useKeyEffect({
    Escape: useCallback(() => {
      if (playerIsSelectingTarget) {
        fightStepSetter("waiting");
      }
    }, [playerIsSelectingTarget]),
  });

  const performOpponentTurn = async () => {
    fightStepSetter("opponent_turn_start");
    let abilityChoosen = null;
    for (const abilityKey of Object.keys(opponentAbilities)) {
      const ability = opponentAbilities[abilityKey];
      if (!ability) {
        continue;
      }
      abilityChoosen = ability;
      break;
    }
    let damage = opponentAttack + abilityChoosen.power - heroDefense;
    if (damage < 0) {
      damage = 0;
    }
    const oponentAlert = dialogRef.current.alert(
      `${opponentName} attaque avec ${abilityChoosen.name}.`,
      {
        timeout: 500,
      },
    );
    await oponentRef.current.glow();
    await oponentAlert.close();
    heroHitSound.play();
    await heroRef.current.recoilAfterHit();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await heroRef.current.displayDamage(damage);
    decreaseHeroHp(damage);
    fightStepSetter("opponent_turn_end");
  };
  const performHeroTurn = async () => {
    fightStepSetter("hero_turn_start");
    const heroAlert = dialogRef.current.alert("Hero attaque avec Epée -A-.", {
      timeout: 500,
    });
    let damage = heroAttack + weaponPower - opponentDefense;
    if (damage < 0) {
      damage = 0;
    }
    await heroRef.current.moveToAct();
    backgroundCurtainRef.current.show({ color: "white" });
    setTimeout(() => {
      backgroundCurtainRef.current?.hide();
    }, 200);
    swordSound.play();
    await oponentRef.current.playWeaponAnimation();
    await heroAlert.close();
    const moveBackToPositionPromise = heroRef.current.moveBackToPosition();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await Promise.all([
      oponentRef.current.displayDamage(damage),
      moveBackToPositionPromise,
    ]);
    decreaseOpponentHp(damage);
    fightStepSetter("hero_turn_end");
  };
  const checkTurnEndEffects = async () => {
    if (opponentHp <= 0) {
      opponentDieSound.play();
      await oponentRef.current.erase();
      opponentIsDeadSetter(true);
      await new Promise((resolve) => setTimeout(resolve, 400));
      victoryMusic.play();
      fightStepSetter("won");
      onFightEnd("won");
      return;
    }
    if (heroHp <= 0) {
      // heroDieSound.play();
      // TODO: an animation or something when hero dies
      // heroIsDeadSetter(true);
      // defeatMusic.play();
      fightStepSetter("lost");
      onFightEnd("lost");
      return;
    }
    if (fightStep === "hero_turn_end") {
      performOpponentTurn();
      return;
    }
    if (fightStep === "opponent_turn_end") {
      fightStepSetter("waiting");
    }
    return;
  };

  useEffect(() => {
    if (fightStep === "hero_turn_end" || fightStep === "opponent_turn_end") {
      checkTurnEndEffects();
    }
  }, [fightStep, opponentHp]);

  const firstTurnRef = useRef(false);
  useEffect(() => {
    if (gamePaused) {
      return;
    }
    if (!opponentImageDisplayed) {
      return;
    }
    if (firstTurnRef.current) {
      return;
    }
    firstTurnRef.current = true;
    if (opponentSpeed <= heroSpeed) {
      return;
    }
    performOpponentTurn();
  }, [gamePaused, opponentImageDisplayed, opponentSpeed, heroSpeed]);

  return (
    <>
      <Box vertical name="game" width="100%" height="...">
        <Box name="background" absolute width="100%" height="100%">
          <MountainAndSkyBattleBackground />
          <Curtain ref={backgroundCurtainRef} />
        </Box>
        <Box name="opponents_box" width="100%" height="55%">
          <Opponent
            ref={oponentRef}
            fightIsWaiting={fightIsWaiting}
            playerIsSelectingTarget={playerIsSelectingTarget}
            isDead={opponentIsDead}
            name={opponentName}
            imageUrl={opponentImage.url}
            imageTransparentColor={opponentImage.transparentColor}
            imageX={opponentImage.x}
            imageY={opponentImage.y}
            imageWidth={opponentImage.width}
            imageHeight={opponentImage.height}
            onFirstDisplay={onOpponentFirstDisplay}
            onSelect={() => {
              performHeroTurn();
            }}
          />
        </Box>
        <Box name="front_line" width="100%" height="10%"></Box>
        <Box name="allies_box" height="15%" width="100%">
          <Ally ref={heroRef} />
        </Box>
        <Box name="bottom_ui" width="100%" height="...">
          <Box
            absolute
            width="100%"
            height="95%"
            contentX="center"
            contentY="end"
            hidden={!fightIsWaiting || fightIsOver}
          >
            <MenuFight
              onAttack={() => {
                if (fightIsWaiting && !gamePaused) {
                  fightStepSetter("player_is_selecting_target");
                }
              }}
            ></MenuFight>
          </Box>
          <DialogTextBox
            ref={dialogRef}
            absolute
            width="90%"
            height="80%"
            contentX="start"
            contentY="start"
            x="center"
            y="center"
          ></DialogTextBox>
        </Box>
      </Box>
      <Box
        name="bottom_hud"
        width="100%"
        height="15%"
        maxHeight="50"
        y="end"
        innerSpacing="xss"
        style={{
          background: "black",
        }}
      >
        <Box
          name="hero_hud"
          width="50%"
          height="100%"
          maxHeight="100%"
          innerSpacing="s"
          border={borderWithStroke({
            color: "white",
            size: 2,
            strokeColor: "black",
          })}
        >
          <Box name="lifebar_box" width="80%" height="30" y="center">
            <Lifebar value={heroHp} max={heroMaxHp} />
          </Box>
          <Box name="weapon_box" ratio="1/1" width="20%" x="end" y="center">
            <SwordAImg />
          </Box>
        </Box>
        <Box
          name="ally_hud"
          width="50%"
          height="100%"
          border={borderWithStroke({
            color: "white",
            size: 2,
            strokeColor: "black",
          })}
        >
          Empty
        </Box>
      </Box>
    </>
  );
};
