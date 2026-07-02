export const authInputClassNames = {
  label: "text-foreground/80",
  input: "text-foreground placeholder:text-default-400",
  inputWrapper:
    "border-default-300 bg-default-50 shadow-sm dark:border-white/10 dark:bg-default-100/10",
};

export const authFieldDefaults = {
  variant: "bordered" as const,
  labelPlacement: "outside" as const,
  radius: "sm" as const,
  classNames: authInputClassNames,
};
