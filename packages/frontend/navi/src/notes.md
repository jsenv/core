1. Faire un exemple de navigation avec une page user et une page table
   comme ca on a le cas de deux routes qui controlle le contenu de la page via
   deux action différente (notre exemple avec pageA/pageB on une action qui controle les deux)

   Pour ce cas je suppose qu'on aure besoin de passer la route pour qu'elle sache si elle match
   genre

```js
<Route route={userRoute}>
  {(user) => {
    return <span>{user.name}</span>;
  }}
</Route>
```

(qui en fait utilisera <ActionRenderer> si la route match, sinon render null)
