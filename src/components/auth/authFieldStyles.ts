export const authInputClassNames = {
  label: "text-foreground/80",
  input: "text-foreground",
  inputWrapper: "border-default-200 bg-transparent dark:border-white/10",
};

export const authFieldDefaults = {
  variant: "bordered" as const,
  labelPlacement: "outside" as const,
  radius: "sm" as const,
  classNames: authInputClassNames,
};
