import React from "react";
import {
  Stack,
  Section,
  Image,
  useApi,
  ScrollView,
  Text,
  Box,
  Button,
  Screen
} from "@shopify/ui-extensions-react/point-of-sale";

export const AllAccessBanner = ({
  customerName = "{Customer Name}",
  tier = "allaccess",
  points = "{Points}",
}: {
  customerName?: string;
  tier?: string;
  points?: string;
}) => {
    const api = useApi<"pos.home.modal.render">()
    const bannerImageUrl =
      "https://cdn.shopify.com/s/files/1/2185/2813/files/all_access_kettle_bell.png?width=600";

  return (
    <Screen name="ALL_ACCESS" title={"ALL ACCESS Member Detected"}  presentation={{ sheet: true }}>
    <Section>
      <ScrollView>
        <Stack direction="vertical" alignItems="center" justifyContent="center">
          <>
            {/* <Box padding="050" /> */}
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Text variant="headingSmall">{customerName}</Text>
              </Stack>
            </Stack>
            <Box padding="200" />
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Text variant="body">
                  Welcome back! This customer is one of our ALL ACCESS members.
                </Text>
              </Stack>
            </Stack>
            <Box padding="050" />
            <Stack alignContent="center" justifyContent="center">
              <Box blockSize="250px" inlineSize="400px" padding="100">
                <Image
                  src={bannerImageUrl}
                  size="contain"
                />
              </Box>
            </Stack>
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Stack direction="inline" gap="none" alignItems="center">
                  <Text variant="body" color="TextSubdued">
                    Tier:{" "}
                  </Text>
                  <Text variant="headingSmall">all</Text>
                  <Text variant="body" color="TextSubdued">
                    access
                  </Text>
                </Stack>
              </Stack>
            </Stack>
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Stack direction="inline" gap="none" alignItems="center">
                  <Text variant="body" color="TextSubdued">
                    Points:{" "}
                  </Text>
                  <Text variant="body" color="TextSubdued">
                    {points} pts
                  </Text>
                </Stack>
              </Stack>
            </Stack>
            <Box padding="100" />
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Text variant="body">
                  Make sure to deliver the elevated ALO experience
                </Text>
              </Stack>
            </Stack>
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Text variant="body">
                  and highlight any available member benefits during checkout
                </Text>
              </Stack>
            </Stack>
            <Box padding="100" />
            <Stack alignContent="center" justifyContent="center">
              <Stack direction="inline" gap="none" alignItems="center">
                <Button title="Continue" type="primary" onPress={() => {api.navigation.dismiss()}} />
              </Stack>
            </Stack>
          </>
        </Stack>
      </ScrollView>
    </Section>
    </Screen>
  );
};
