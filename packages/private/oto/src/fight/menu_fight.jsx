import { ButtonMessage } from "/components/button/button.jsx";

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
