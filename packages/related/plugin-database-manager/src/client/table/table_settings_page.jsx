export const TableSettingsPage = ({ table }) => {
  const tablename = table.tablename;
  const deleteTableAction = TABLE.DELETE.bindParams({ tablename });

  return (
    <div>
      <p>
        <Button
          data-confirm-message={`Are you sure you want to delete the table "${tablename}"?`}
          action={deleteTableAction}
        >
          Delete this table
        </Button>
      </p>
    </div>
  );
};
