import { ButtonMessage } from "oto/src/components/button/button.jsx";

export const MenuFight = ({ onAttack }) => {
  return (
    <ButtonMessage
      y="end"
      onClick={() => {
        onAttack();
      }}
    >
      Attaque
    </ButtonMessage>
  );
};
