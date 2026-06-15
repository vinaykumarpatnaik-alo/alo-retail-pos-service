import React from 'react';
import {
  Text, Stack
} from '@shopify/ui-extensions-react/point-of-sale';
export const AloHeader = ({ tierState }) => {
  const tierData = [
    tierState?.name,
    tierState?.tierType,
    tierState?.pointsBalance,
  ];
  const invalidTier = "N/A";
  return (
    <Stack direction="inline" justifyContent="space-around" blockSize="50px">
      {tierData.map((tier, index) => {
        return (<><Stack direction="inline" gap="200" key={`${tier.tierField}`} alignContent='center' alignItems='center'>
          <Text children={`${tier.tierField}:`} />
          <Text children={`${tier.tierFieldValue}`} color={tier.tierField === 'Tier' ? "TextSuccess" : "TextNeutral"} />
        </Stack>
        </>
        )
      })}
    </Stack>
  );
};