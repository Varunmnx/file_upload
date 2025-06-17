import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { TextInput, Button, Box, Group } from "@mantine/core";

// Validation schema
const validationSchema = Yup.object().shape({
  name: Yup.string().required("Name is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
});

type FormData = Yup.InferType<typeof validationSchema>;

const Login = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(validationSchema),
    mode: "onBlur", // Validate on blur
  });

  const onSubmit = (data: FormData) => {
    console.log("Form data:", data);
  };

  return (
    <Box
      style={{
        maxWidth: 400,
        margin: "0 auto",
        padding: "1rem",
        border: "1px solid #eaeaea",
        borderRadius: "8px",
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Name Input */}
        <TextInput
          label="Name"
          placeholder="Enter your name"
          {...register("name")}
          error={errors.name?.message}
        />

        {/* Email Input */}
        <TextInput
          label="Email"
          placeholder="Enter your email"
          {...register("email")}
          error={errors.email?.message}
          mt="md"
        />

        {/* Submit Button */}
        <Group mt="md">
          <Button type="submit">Submit</Button>
        </Group>
      </form>
    </Box>
  );
};

export default Login;
